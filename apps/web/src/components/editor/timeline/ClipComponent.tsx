import React, { useRef, useState, useEffect, useMemo } from "react";
import { Image } from "lucide-react";
import type { Clip, Track } from "@openreel/core";
import { useProjectStore } from "../../../stores/project-store";
import { useUIStore } from "../../../stores/ui-store";
import { useTimelineStore } from "../../../stores/timeline-store";
import { calculateSnap, generateWaveformPath, getClipStyle } from "./utils";
import { ClipContextMenu } from "./ClipContextMenu";
import { ContextMenu, ContextMenuTrigger } from "@openreel/ui";

interface ClipComponentProps {
  clip: Clip;
  track: Track;
  allTracks: Track[];
  pixelsPerSecond: number;
  isSelected: boolean;
  trackHeights: Map<string, number>;
  timelineRef: React.RefObject<HTMLDivElement>;
  onSelect: (clipId: string, addToSelection: boolean) => void;
  onMoveClip: (
    clipId: string,
    newStartTime: number,
    targetTrackId?: string,
  ) => void;
  onSnapIndicator: (time: number | null) => void;
  onTrimClip?: (
    clipId: string,
    edge: "left" | "right",
    newTime: number,
  ) => void;
}

const AUTO_SCROLL_THRESHOLD = 80;
const AUTO_SCROLL_SPEED = 10;
const DRAG_THRESHOLD = 5;

export const ClipComponent: React.FC<ClipComponentProps> = ({
  clip,
  track,
  allTracks,
  pixelsPerSecond,
  isSelected,
  trackHeights,
  timelineRef,
  onSelect,
  onMoveClip,
  onSnapIndicator,
  onTrimClip,
}) => {
  const { getMediaItem, updateClipKeyframes } = useProjectStore();
  const { snapSettings, setPanelVisible } = useUIStore();
  const { playheadPosition } = useTimelineStore();
  const mediaItem = getMediaItem(clip.mediaId);
  const [isDragging, setIsDragging] = useState(false);
  const [isPendingDrag, setIsPendingDrag] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragYOffset, setDragYOffset] = useState(0);
  const [isInvalidDrop, setIsInvalidDrop] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimEdge, setTrimEdge] = useState<"left" | "right" | null>(null);
  const trimStartRef = useRef<{
    mouseX: number;
    startTime: number;
    duration: number;
  }>({
    mouseX: 0,
    startTime: clip.startTime,
    duration: clip.duration,
  });
  const dragStartRef = useRef<{ mouseY: number; clipY: number; scrollTop: number }>({
    mouseY: 0,
    clipY: 0,
    scrollTop: 0,
  });
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pendingDropRef = useRef<{ time: number; targetTrackId?: string }>({ time: 0 });
  const dragPendingRef = useRef<{ active: boolean; startX: number; startY: number }>({
    active: false,
    startX: 0,
    startY: 0,
  });
  const clipRef = useRef<HTMLDivElement>(null);

  // Memoize keyframe lanes rendering
  const keyframeLanes = useMemo(() => {
    if (!clip.keyframes || clip.keyframes.length === 0) return null;

    const KEYFRAME_LANE_HEIGHT = 16;
    const PROPERTY_COLORS: Record<string, string> = {
      "opacity": "#fbbf24",
      "position.x": "#22d3ee",
      "position.y": "#a78bfa",
      "scale.x": "#fb923c",
      "scale.y": "#f472b6",
      "rotation": "#34d399",
      "default": "#6b7280",
    };

    const keyframesByProperty = new Map<string, typeof clip.keyframes>();
    for (const kf of clip.keyframes) {
      const existing = keyframesByProperty.get(kf.property) || [];
      existing.push(kf);
      keyframesByProperty.set(kf.property, existing);
    }

    const properties = Array.from(keyframesByProperty.keys()).sort();
    const totalLanesHeight = properties.length * KEYFRAME_LANE_HEIGHT;

    return (
      <div 
        className="absolute bottom-0 left-0 right-0 pointer-events-auto z-20"
        style={{ height: totalLanesHeight }}
      >
        {properties.map((property, idx) => {
          const propertyKeyframes = keyframesByProperty.get(property)!;
          const color = PROPERTY_COLORS[property] || PROPERTY_COLORS.default;

          return (
            <div
              key={property}
              className="absolute left-0 right-0"
              style={{
                bottom: idx * KEYFRAME_LANE_HEIGHT,
                height: KEYFRAME_LANE_HEIGHT,
                background: 'rgba(0,0,0,0.2)',
              }}
            >
              <div
                className="absolute left-0 right-0"
                style={{
                  top: KEYFRAME_LANE_HEIGHT / 2,
                  height: 1,
                  background: 'rgba(255,255,255,0.1)',
                }}
              />

              {propertyKeyframes.map((kf) => {
                const xPos = (kf.time / clip.duration) * 100;

                const handleKeyframeMouseDown = (e: React.MouseEvent, keyframeId: string) => {
                  e.stopPropagation();

                  const clipElement = e.currentTarget.closest('[data-clip-id]') as HTMLElement;
                  if (!clipElement) return;

                  const startX = e.clientX;
                  const clipRect = clipElement.getBoundingClientRect();
                  const clipWidth = clipRect.width;
                  let hasMoved = false;

                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const deltaX = moveEvent.clientX - startX;
                    if (Math.abs(deltaX) > 3) hasMoved = true;

                    const currentXInClip = (xPos / 100) * clipWidth + deltaX;
                    const newTimePercent = Math.max(0, Math.min(100, (currentXInClip / clipWidth) * 100));
                    const newTime = (newTimePercent / 100) * clip.duration;

                    const updatedKeyframes = clip.keyframes!.map(k =>
                      k.id === keyframeId ? { ...k, time: newTime } : k
                    );
                    updateClipKeyframes(clip.id, updatedKeyframes);
                  };

                  const handleMouseUp = (upEvent: MouseEvent) => {
                    upEvent.stopPropagation();
                    upEvent.preventDefault();
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);

                    if (!hasMoved) {
                      onSelect(clip.id, false);
                      setPanelVisible('inspector', true);
                      sessionStorage.setItem('openreel_selected_keyframe_property', property);
                    }
                  };

                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                };

                return (
                  <div
                    key={kf.id}
                    className="absolute pointer-events-auto cursor-move z-30"
                    style={{
                      left: `${xPos}%`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                    title={`${property}: ${kf.value}`}
                    onMouseDown={(e) => handleKeyframeMouseDown(e, kf.id)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="w-2 h-2 rotate-45"
                      style={{
                        backgroundColor: color,
                        boxShadow: '0 0 2px rgba(0,0,0,0.5)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }, [clip.keyframes, clip.duration, clip.id, onSelect, updateClipKeyframes, setPanelVisible]);

  const left = clip.startTime * pixelsPerSecond;
  const width = clip.duration * pixelsPerSecond;

  const isVideo = track.type === "video";
  const isAudio = track.type === "audio";
  const isImage = track.type === "image";
  const clipStyle = getClipStyle(track.type);

  const handleClick = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (isDragging || isPendingDrag) return;
    e.stopPropagation();
    onSelect(clip.id, e.shiftKey || e.metaKey);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (track.locked || isTrimming) return;
    e.stopPropagation();

    const rect = clipRef.current?.parentElement?.getBoundingClientRect();
    const clipRect = clipRef.current?.getBoundingClientRect();
    if (!rect || !clipRect) return;

    const clickX = e.clientX - rect.left;
    const clipStartX = clip.startTime * pixelsPerSecond;
    setDragOffset(clickX - clipStartX);

    dragStartRef.current = {
      mouseY: e.clientY,
      clipY: clipRect.top - rect.top,
      scrollTop: timelineRef.current?.scrollTop || 0,
    };
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
    dragPendingRef.current = { active: true, startX: e.clientX, startY: e.clientY };
    setDragYOffset(0);
    setIsInvalidDrop(false);
    setIsPendingDrag(true);
  };

  const handleTrimMouseDown =
    (edge: "left" | "right") => (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (track.locked || !onTrimClip) return;
      e.stopPropagation();
      setIsTrimming(true);
      setTrimEdge(edge);
      trimStartRef.current = {
        mouseX: e.clientX,
        startTime: clip.startTime,
        duration: clip.duration,
      };
      document.body.style.cursor = "ew-resize";
    };

  useEffect(() => {
    if (!isPendingDrag) return;

    const handlePendingMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragPendingRef.current.startX;
      const dy = e.clientY - dragPendingRef.current.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance >= DRAG_THRESHOLD) {
        dragPendingRef.current.active = false;
        setIsPendingDrag(false);
        setIsDragging(true);
      }
    };

    const handlePendingMouseUp = (e: MouseEvent) => {
      dragPendingRef.current.active = false;
      setIsPendingDrag(false);
      onSelect(clip.id, e.shiftKey || e.metaKey);
    };

    window.addEventListener("mousemove", handlePendingMouseMove);
    window.addEventListener("mouseup", handlePendingMouseUp);

    return () => {
      window.removeEventListener("mousemove", handlePendingMouseMove);
      window.removeEventListener("mouseup", handlePendingMouseUp);
    };
  }, [isPendingDrag, clip.id, onSelect]);

  useEffect(() => {
    if (!isDragging) return;

    let animationFrameId: number | null = null;

    const scrollLoop = () => {
      if (!timelineRef.current) {
        animationFrameId = requestAnimationFrame(scrollLoop);
        return;
      }

      const timeline = timelineRef.current;
      const timelineRect = timeline.getBoundingClientRect();
      const mouseY = mousePositionRef.current.y;
      const timelineTop = timelineRect.top;
      const timelineBottom = timelineRect.bottom;
      const canScrollUp = timeline.scrollTop > 0;
      const canScrollDown = timeline.scrollTop < timeline.scrollHeight - timeline.clientHeight;

      const distanceFromTop = mouseY - timelineTop;
      const distanceFromBottom = timelineBottom - mouseY;

      if (distanceFromTop < AUTO_SCROLL_THRESHOLD && canScrollUp) {
        timeline.scrollTop -= AUTO_SCROLL_SPEED;
      } else if (distanceFromBottom < AUTO_SCROLL_THRESHOLD && canScrollDown) {
        timeline.scrollTop += AUTO_SCROLL_SPEED;
      }

      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    animationFrameId = requestAnimationFrame(scrollLoop);

    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current.x = e.clientX;
      mousePositionRef.current.y = e.clientY;

      const rect = clipRef.current?.parentElement?.getBoundingClientRect();
      const timelineRect = timelineRef.current?.getBoundingClientRect();
      if (!rect || !timelineRect) return;

      const x = e.clientX - rect.left - dragOffset;
      const rawTime = Math.max(0, x / pixelsPerSecond);

      const snapResult = calculateSnap(
        rawTime,
        clip.id,
        allTracks,
        playheadPosition,
        snapSettings,
        pixelsPerSecond,
      );

      const currentScrollTop = timelineRef.current?.scrollTop || 0;
      const scrollDelta = currentScrollTop - dragStartRef.current.scrollTop;
      const yDelta = (e.clientY - dragStartRef.current.mouseY) + scrollDelta;
      setDragYOffset(yDelta);

      const scrollTop = timelineRef.current?.scrollTop || 0;
      const mouseY = e.clientY - timelineRect.top + scrollTop;
      let targetTrackId: string | undefined;
      let hoveredTrackType: string | undefined;
      let cumulativeY = 0;

      for (const t of allTracks) {
        const height = trackHeights.get(t.id) || 60;
        if (mouseY >= cumulativeY && mouseY < cumulativeY + height) {
          hoveredTrackType = t.type;
          if (t.type === track.type && t.id !== track.id) {
            targetTrackId = t.id;
          }
          break;
        }
        cumulativeY += height;
      }

      const isOverDifferentTrackType = hoveredTrackType !== undefined && hoveredTrackType !== track.type;
      setIsInvalidDrop(isOverDifferentTrackType);

      pendingDropRef.current = { time: snapResult.time, targetTrackId };
      onMoveClip(clip.id, snapResult.time, undefined);
      onSnapIndicator(snapResult.snapped ? snapResult.time : null);
    };

    const handleMouseUp = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      const { time, targetTrackId } = pendingDropRef.current;
      if (targetTrackId) {
        onMoveClip(clip.id, time, targetTrackId);
      }

      setIsDragging(false);
      setDragYOffset(0);
      setIsInvalidDrop(false);
      onSnapIndicator(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    dragOffset,
    pixelsPerSecond,
    clip.id,
    track.id,
    track.type,
    allTracks,
    trackHeights,
    timelineRef,
    playheadPosition,
    snapSettings,
    onMoveClip,
    onSnapIndicator,
  ]);

  useEffect(() => {
    if (!isTrimming || !trimEdge || !onTrimClip) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - trimStartRef.current.mouseX;
      const deltaTime = deltaX / pixelsPerSecond;

      if (trimEdge === "left") {
        const newStartTime = Math.max(
          0,
          trimStartRef.current.startTime + deltaTime,
        );
        const maxStartTime =
          trimStartRef.current.startTime + trimStartRef.current.duration - 0.1;
        const clampedStartTime = Math.min(newStartTime, maxStartTime);
        onTrimClip(clip.id, "left", clampedStartTime);
      } else {
        const newEndTime =
          trimStartRef.current.startTime +
          trimStartRef.current.duration +
          deltaTime;
        const minEndTime = trimStartRef.current.startTime + 0.1;
        const clampedEndTime = Math.max(newEndTime, minEndTime);
        onTrimClip(clip.id, "right", clampedEndTime);
      }
    };

    const handleMouseUp = () => {
      setIsTrimming(false);
      setTrimEdge(null);
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isTrimming, trimEdge, clip.id, pixelsPerSecond, onTrimClip]);

  const thumbnailCount = Math.max(1, Math.floor(width / 60));
  const clipName = mediaItem?.name || clip.mediaId.slice(0, 8);

  const isInteracting = isDragging || isTrimming;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={clipRef}
          data-clip-id={clip.id}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          className={`group absolute top-1 bottom-1 rounded-lg overflow-hidden shadow-sm ${
            isDragging
              ? `cursor-grabbing z-50 ${isInvalidDrop ? "opacity-50 ring-2 ring-red-500 border-red-500" : "opacity-90 shadow-xl"}`
              : "cursor-grab"
          } ${
            isSelected && !isDragging
              ? "ring-2 ring-primary border-primary z-10"
              : !isDragging ? "border-opacity-30 hover:border-opacity-60 hover:brightness-110" : ""
          } ${clipStyle.bg} border ${clipStyle.border} ${
            track.locked ? "cursor-not-allowed opacity-60" : ""
          }`}
          style={{
            transform: isDragging
              ? `translate(${left}px, ${dragYOffset}px)`
              : `translateX(${left}px)`,
            width: `${width}px`,
            willChange: isInteracting ? 'transform, width' : 'auto',
            transition: isInteracting ? 'none' : 'opacity 150ms, box-shadow 150ms',
            pointerEvents: isDragging ? 'none' : 'auto',
          }}
        >
      {isVideo &&
        (mediaItem?.filmstripThumbnails?.length || mediaItem?.thumbnailUrl) && (
          <div className="absolute inset-0 flex pointer-events-none">
            {mediaItem?.filmstripThumbnails &&
            mediaItem.filmstripThumbnails.length > 0
              ? Array.from({ length: thumbnailCount }).map((_, i) => {
                  const clipProgress = i / Math.max(1, thumbnailCount - 1);
                  const thumbIndex = Math.min(
                    Math.floor(
                      clipProgress * mediaItem.filmstripThumbnails!.length,
                    ),
                    mediaItem.filmstripThumbnails!.length - 1,
                  );
                  const thumb = mediaItem.filmstripThumbnails![thumbIndex];
                  return (
                    <div
                      key={i}
                      className="flex-1 h-full bg-cover bg-center opacity-70"
                      style={{
                        backgroundImage: `url(${thumb.url})`,
                        borderRight:
                          i < thumbnailCount - 1
                            ? "1px solid rgba(0,0,0,0.2)"
                            : "none",
                      }}
                    />
                  );
                })
              : Array.from({ length: thumbnailCount }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 h-full bg-cover bg-center opacity-60"
                    style={{
                      backgroundImage: `url(${mediaItem.thumbnailUrl})`,
                      borderRight:
                        i < thumbnailCount - 1
                          ? "1px solid rgba(0,0,0,0.2)"
                          : "none",
                    }}
                  />
                ))}
          </div>
        )}

      {isVideo && !mediaItem?.thumbnailUrl && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 pointer-events-none" />
      )}

      {isImage && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-purple-500/10 flex items-center justify-center pointer-events-none">
          {mediaItem?.thumbnailUrl ? (
            <img
              src={mediaItem.thumbnailUrl}
              alt={clipName}
              className="h-full object-cover opacity-60"
            />
          ) : (
            <Image size={24} className="text-purple-400/50" />
          )}
        </div>
      )}

      <div className="w-full h-full flex flex-col justify-start px-2 pt-1 relative z-10 pointer-events-none">
        <span
          className={`text-[10px] font-medium truncate drop-shadow-md ${
            isSelected ? clipStyle.selectedText : clipStyle.text
          }`}
        >
          {clipName}
        </span>
      </div>

      {isAudio && (
        <>
          <div className="absolute inset-0 flex items-center opacity-50 px-1 pointer-events-none">
            {mediaItem?.waveformData ? (
              <svg
                className="w-full h-full"
                preserveAspectRatio="none"
                viewBox="0 0 100 40"
              >
                <path
                  d={generateWaveformPath(mediaItem.waveformData, 100)}
                  stroke="currentColor"
                  className="text-blue-400"
                  fill="none"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ) : (
              <svg className="w-full h-full" preserveAspectRatio="none">
                <path
                  d="M0,20 Q10,5 20,20 T40,20 T60,20 T80,20 T100,20"
                  stroke="currentColor"
                  className="text-blue-400"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
          </div>
          <div className="absolute inset-x-0 top-1 flex justify-center opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-blue-300" />
              <div className="w-1 h-1 rounded-full bg-blue-300" />
              <div className="w-1 h-1 rounded-full bg-blue-300" />
            </div>
          </div>
        </>
      )}

      {isSelected && (
        <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none shadow-[inset_0_0_10px_rgba(34,197,94,0.2)]" />
      )}

      {/* Keyframe lanes */}
      {keyframeLanes}

      {(isVideo || isImage || isAudio) && onTrimClip && (
        <>
          <div
            onMouseDown={handleTrimMouseDown("left")}
            className={`absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-10 opacity-0 group-hover:opacity-100 transition-opacity ${
              isAudio ? "hover:bg-blue-400/50" : isVideo ? "hover:bg-green-400/50" : "hover:bg-purple-400/50"
            }`}
            onClick={(e) => e.stopPropagation()}
            title="Drag to adjust start"
          />
          <div
            onMouseDown={handleTrimMouseDown("right")}
            className={`absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-10 opacity-0 group-hover:opacity-100 transition-opacity ${
              isAudio ? "hover:bg-blue-400/50" : isVideo ? "hover:bg-green-400/50" : "hover:bg-purple-400/50"
            }`}
            onClick={(e) => e.stopPropagation()}
            title="Drag to adjust end"
          />
        </>
      )}

        </div>
      </ContextMenuTrigger>
      <ClipContextMenu clip={clip} track={track} />
    </ContextMenu>
  );
};
