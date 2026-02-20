import React, { useCallback, useState, useRef, useEffect } from "react";
import type { Keyframe } from "@openreel/core";

interface KeyframeDiamondProps {
  keyframe: Keyframe;
  pixelsPerSecond: number;
  clipStartTime: number;
  onTimeChange: (keyframeId: string, newTime: number) => void;
  onSelect?: (keyframeId: string) => void;
  isSelected?: boolean;
}

const DEFAULT_COLORS: Record<string, string> = {
  "position.x": "#3b82f6", // blue
  "position.y": "#8b5cf6", // purple
  "scale.x": "#10b981", // green
  "scale.y": "#059669", // emerald
  "rotation": "#f59e0b", // amber
  "opacity": "#ef4444", // red
  "default": "#6b7280", // gray
};

export const KeyframeDiamond: React.FC<KeyframeDiamondProps> = ({
  keyframe,
  pixelsPerSecond,
  clipStartTime,
  onTimeChange,
  onSelect,
  isSelected = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const diamondRef = useRef<HTMLDivElement>(null);

  const color = keyframe.color || DEFAULT_COLORS[keyframe.property] || DEFAULT_COLORS.default;
  const position = keyframe.time * pixelsPerSecond;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setDragStartX(e.clientX);
      setDragStartTime(keyframe.time);
      onSelect?.(keyframe.id);
    },
    [keyframe.id, keyframe.time, onSelect],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaX = e.clientX - dragStartX;
      const deltaTime = deltaX / pixelsPerSecond;
      const newTime = Math.max(0, dragStartTime + deltaTime);
      
      onTimeChange(keyframe.id, newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStartX, dragStartTime, pixelsPerSecond, keyframe.id, onTimeChange]);

  return (
    <div
      ref={diamondRef}
      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab ${
        isDragging ? "cursor-grabbing z-50" : "z-10"
      } ${isSelected ? "scale-125" : ""} transition-transform hover:scale-110`}
      style={{ left: `${position}px` }}
      onMouseDown={handleMouseDown}
      title={`${keyframe.property} @ ${(clipStartTime + keyframe.time).toFixed(2)}s = ${
        typeof keyframe.value === "number" ? keyframe.value.toFixed(2) : keyframe.value
      }`}
    >
      <div
        className={`w-3 h-3 rotate-45 border-2 ${
          isSelected ? "border-white" : "border-background"
        } shadow-lg`}
        style={{ backgroundColor: color }}
      />
    </div>
  );
};
