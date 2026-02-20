import React, { useMemo, useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Keyframe } from "@openreel/core";
import { KeyframePropertyRow } from "./KeyframePropertyRow";

interface KeyframeTrackFooterProps {
  keyframes: Keyframe[];
  pixelsPerSecond: number;
  scrollX: number;
  clipStartTime: number;
  timelineDuration: number;
  onKeyframeTimeChange: (keyframeId: string, newTime: number) => void;
}

const PROPERTY_LABELS: Record<string, string> = {
  "position.x": "Position X",
  "position.y": "Position Y",
  "scale.x": "Scale X",
  "scale.y": "Scale Y",
  "rotation": "Rotation",
  "opacity": "Opacity",
  "anchor.x": "Anchor X",
  "anchor.y": "Anchor Y",
};

export const KeyframeTrackFooter: React.FC<KeyframeTrackFooterProps> = ({
  keyframes,
  pixelsPerSecond,
  clipStartTime,
  timelineDuration,
  onKeyframeTimeChange,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);

  const uniqueProperties = useMemo(() => {
    const props = new Set(keyframes.map((kf) => kf.property));
    return Array.from(props).sort();
  }, [keyframes]);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  if (keyframes.length === 0) return null;

  return (
    <div className="border-t-2 border-border bg-background-secondary">
      <div className="flex items-center justify-between px-3 py-1.5 bg-background-tertiary border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleCollapse}
            className="p-0.5 hover:bg-background-elevated rounded transition-colors"
            title={isCollapsed ? "Expand keyframe tracks" : "Collapse keyframe tracks"}
          >
            {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <span className="text-[10px] font-semibold text-text-primary uppercase tracking-wide">
            Keyframe Tracks
          </span>
          <span className="text-[9px] text-text-muted">
            ({keyframes.length} keyframe{keyframes.length !== 1 ? "s" : ""})
          </span>
        </div>
      </div>

      {!isCollapsed && (
        <div className="relative overflow-x-auto overflow-y-visible custom-scrollbar">
          <div className="flex flex-col min-w-full">
            {uniqueProperties.map((property) => (
              <KeyframePropertyRow
                key={property}
                property={property}
                propertyLabel={PROPERTY_LABELS[property] || property}
                keyframes={keyframes}
                pixelsPerSecond={pixelsPerSecond}
                clipStartTime={clipStartTime}
                timelineDuration={timelineDuration}
                onKeyframeTimeChange={onKeyframeTimeChange}
                onKeyframeSelect={setSelectedKeyframeId}
                selectedKeyframeId={selectedKeyframeId || undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
