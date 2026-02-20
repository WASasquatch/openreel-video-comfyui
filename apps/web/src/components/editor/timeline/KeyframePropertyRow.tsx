import React from "react";
import type { Keyframe } from "@openreel/core";
import { KeyframeDiamond } from "./KeyframeDiamond";

interface KeyframePropertyRowProps {
  property: string;
  propertyLabel: string;
  keyframes: Keyframe[];
  pixelsPerSecond: number;
  clipStartTime: number;
  timelineDuration: number;
  onKeyframeTimeChange: (keyframeId: string, newTime: number) => void;
  onKeyframeSelect?: (keyframeId: string) => void;
  selectedKeyframeId?: string;
}

export const KeyframePropertyRow: React.FC<KeyframePropertyRowProps> = ({
  property,
  propertyLabel,
  keyframes,
  pixelsPerSecond,
  clipStartTime,
  timelineDuration,
  onKeyframeTimeChange,
  onKeyframeSelect,
  selectedKeyframeId,
}) => {
  const propertyKeyframes = keyframes.filter((kf) => kf.property === property);

  if (propertyKeyframes.length === 0) return null;

  return (
    <div className="relative h-10 border-b border-border bg-background flex">
      {/* Fixed label column */}
      <div className="sticky left-0 w-32 flex items-center px-3 border-r border-border bg-background-tertiary z-20">
        <span className="text-[11px] font-semibold text-text-primary truncate">
          {propertyLabel}
        </span>
      </div>
      
      {/* Track area with horizontal line */}
      <div className="relative flex-1 bg-background-secondary">
        {/* Horizontal track line */}
        <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-border-strong" />
        
        {/* Keyframe container */}
        <div
          className="relative h-full"
          style={{ width: `${timelineDuration * pixelsPerSecond}px` }}
        >
          {propertyKeyframes.map((keyframe) => (
            <KeyframeDiamond
              key={keyframe.id}
              keyframe={keyframe}
              pixelsPerSecond={pixelsPerSecond}
              clipStartTime={clipStartTime}
              onTimeChange={onKeyframeTimeChange}
              onSelect={onKeyframeSelect}
              isSelected={selectedKeyframeId === keyframe.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
