import React, { useMemo, useCallback } from "react";
import type { Keyframe, Clip } from "@openreel/core";
import { KeyframeMarker } from "./KeyframeMarker";

const PROPERTY_COLORS: Record<string, string> = {
  "position.x": "#22d3ee",
  "position.y": "#a78bfa",
  "scale.x": "#4ade80",
  "scale.y": "#86efac",
  rotation: "#f472b6",
  opacity: "#fbbf24",
  borderRadius: "#94a3b8",
  default: "#64748b",
};

const PROPERTY_LABELS: Record<string, string> = {
  "position.x": "Position X",
  "position.y": "Position Y",
  "scale.x": "Scale X",
  "scale.y": "Scale Y",
  rotation: "Rotation",
  opacity: "Opacity",
  borderRadius: "Border Radius",
};

interface KeyframeTrackProps {
  clip: Clip;
  pixelsPerSecond: number;
  onKeyframeSelect: (keyframeId: string, addToSelection: boolean) => void;
  onKeyframeMove: (keyframeId: string, newTime: number) => void;
  onKeyframeDelete: (keyframeId: string) => void;
  selectedKeyframeIds: string[];
}

interface PropertyGroup {
  property: string;
  keyframes: Keyframe[];
  color: string;
  label: string;
}

export const KeyframeTrack: React.FC<KeyframeTrackProps> = ({
  clip,
  pixelsPerSecond,
  onKeyframeSelect,
  onKeyframeMove,
  onKeyframeDelete,
  selectedKeyframeIds,
}) => {

  const propertyGroups = useMemo((): PropertyGroup[] => {
    const groups = new Map<string, Keyframe[]>();

    for (const kf of clip.keyframes) {
      const existing = groups.get(kf.property) || [];
      existing.push(kf);
      groups.set(kf.property, existing);
    }

    return Array.from(groups.entries())
      .map(([property, keyframes]) => ({
        property,
        keyframes: keyframes.sort((a, b) => a.time - b.time),
        color: PROPERTY_COLORS[property] || PROPERTY_COLORS.default,
        label: PROPERTY_LABELS[property] || property,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clip.keyframes]);

  const handleKeyframeMove = useCallback(
    (keyframeId: string, deltaPixels: number) => {
      const deltaTime = deltaPixels / pixelsPerSecond;
      const keyframe = clip.keyframes.find((kf) => kf.id === keyframeId);
      if (!keyframe) return;

      const newTime = Math.max(0, Math.min(clip.duration, keyframe.time + deltaTime));
      onKeyframeMove(keyframeId, newTime);
    },
    [clip.keyframes, clip.duration, pixelsPerSecond, onKeyframeMove]
  );

  if (propertyGroups.length === 0) return null;

  const PROPERTY_ROW_HEIGHT = 20;

  return (
    <div style={{ background: 'rgba(0,0,0,0.125)' }}>
      {propertyGroups.map((group) => (
        <div
          key={group.property}
          className="relative"
          style={{ height: PROPERTY_ROW_HEIGHT }}
        >
          {/* Center track line */}
          <div
            className="absolute left-0 right-0"
            style={{ top: PROPERTY_ROW_HEIGHT / 2, height: 1, background: 'rgba(0,0,0,0.2)' }}
          />

          {/* Keyframe diamonds */}
          <div className="absolute left-0 right-0 top-0 bottom-0">
            {group.keyframes.map((keyframe) => {
              const xPos = keyframe.time * pixelsPerSecond;

              return (
                <KeyframeMarker
                  key={keyframe.id}
                  keyframe={keyframe}
                  xPosition={xPos}
                  color={group.color}
                  label={group.label}
                  isSelected={selectedKeyframeIds.includes(keyframe.id)}
                  onSelect={(addToSelection) =>
                    onKeyframeSelect(keyframe.id, addToSelection)
                  }
                  onMove={(deltaPixels) =>
                    handleKeyframeMove(keyframe.id, deltaPixels)
                  }
                  onDelete={() => onKeyframeDelete(keyframe.id)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KeyframeTrack;
