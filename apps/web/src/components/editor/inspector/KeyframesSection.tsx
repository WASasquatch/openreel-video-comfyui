import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Key,
  Plus,
  Trash2,
  ChevronDown,
  Diamond,
  DiamondIcon,
} from "lucide-react";
import { useProjectStore } from "../../../stores/project-store";
import { useTimelineStore } from "../../../stores/timeline-store";
import { useEngineStore } from "../../../stores/engine-store";
import {
  KeyframeEngine,
  EASING_CATEGORIES,
  type EasingName,
} from "@openreel/core";
import type { Keyframe, EasingType } from "@openreel/core";

const keyframeEngine = new KeyframeEngine();

interface AnimatableProperty {
  id: string;
  label: string;
  category: string;
  defaultValue: unknown;
  min?: number;
  max?: number;
  step?: number;
  supportedTrackTypes?: ("video" | "image" | "audio" | "graphics" | "text")[];
}

const ANIMATABLE_PROPERTIES: AnimatableProperty[] = [
  {
    id: "position.x",
    label: "Position X",
    category: "Transform",
    defaultValue: 0,
    min: -2000,
    max: 2000,
    supportedTrackTypes: ["video", "image", "graphics", "text"],
  },
  {
    id: "position.y",
    label: "Position Y",
    category: "Transform",
    defaultValue: 0,
    min: -2000,
    max: 2000,
    supportedTrackTypes: ["video", "image", "graphics", "text"],
  },
  {
    id: "scale.x",
    label: "Scale X",
    category: "Transform",
    defaultValue: 1,
    min: 0,
    max: 16,
    step: 0.01,
    supportedTrackTypes: ["video", "image", "graphics", "text"],
  },
  {
    id: "scale.y",
    label: "Scale Y",
    category: "Transform",
    defaultValue: 1,
    min: 0,
    max: 16,
    step: 0.01,
    supportedTrackTypes: ["video", "image", "graphics", "text"],
  },
  {
    id: "rotation",
    label: "Rotation",
    category: "Transform",
    defaultValue: 0,
    min: -360,
    max: 360,
    supportedTrackTypes: ["video", "image", "graphics", "text"],
  },
  {
    id: "opacity",
    label: "Opacity",
    category: "Transform",
    defaultValue: 1,
    min: 0,
    max: 1,
    step: 0.01,
    supportedTrackTypes: ["video", "image", "graphics", "text"],
  },
  // Effect parameters
  {
    id: "effect.brightness",
    label: "Brightness",
    category: "Effects",
    defaultValue: 0,
    min: -100,
    max: 100,
    supportedTrackTypes: ["video", "image"],
  },
  {
    id: "effect.contrast",
    label: "Contrast",
    category: "Effects",
    defaultValue: 1,
    min: 0,
    max: 2,
    step: 0.01,
    supportedTrackTypes: ["video", "image"],
  },
  {
    id: "effect.saturation",
    label: "Saturation",
    category: "Effects",
    defaultValue: 1,
    min: 0,
    max: 2,
    step: 0.01,
    supportedTrackTypes: ["video", "image"],
  },
  {
    id: "effect.blur",
    label: "Blur",
    category: "Effects",
    defaultValue: 0,
    min: 0,
    max: 100,
    supportedTrackTypes: ["video", "image"],
  },
  {
    id: "volume",
    label: "Volume",
    category: "Audio",
    defaultValue: 1,
    min: 0,
    max: 2,
    step: 0.01,
    supportedTrackTypes: ["audio", "video"],
  },
  {
    id: "pan",
    label: "Pan (Audio L/R)",
    category: "Audio",
    defaultValue: 0,
    min: -1,
    max: 1,
    step: 0.01,
    supportedTrackTypes: ["audio", "video"],
  },
];

const formatEasingLabel = (easing: string): string => {
  return (
    easing
      .replace(/([A-Z])/g, " $1")
      .replace(/^ease/, "")
      .trim() || easing
  );
};

const PropertySelector: React.FC<{
  selectedProperty: string | null;
  onSelect: (propertyId: string) => void;
  existingProperties: string[];
}> = ({ selectedProperty, onSelect, existingProperties }) => {
  const [isOpen, setIsOpen] = useState(false);

  const categories = [...new Set(ANIMATABLE_PROPERTIES.map((p) => p.category))];

  const selectedLabel = selectedProperty
    ? ANIMATABLE_PROPERTIES.find((p) => p.id === selectedProperty)?.label ||
      selectedProperty
    : "Select Property";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-background-tertiary border border-border rounded-lg text-[10px] text-text-primary hover:border-text-secondary transition-colors"
      >
        <span>{selectedLabel}</span>
        <ChevronDown
          size={12}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-background-secondary border border-border rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
            {categories.map((category) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-[9px] font-medium text-text-muted uppercase tracking-wider bg-background-tertiary">
                  {category}
                </div>
                {ANIMATABLE_PROPERTIES.filter(
                  (p) => p.category === category,
                ).map((prop) => {
                  const hasKeyframes = existingProperties.includes(prop.id);
                  return (
                    <button
                      key={prop.id}
                      onClick={() => {
                        onSelect(prop.id);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-[10px] hover:bg-background-tertiary transition-colors flex items-center justify-between gap-2 ${
                        selectedProperty === prop.id
                          ? "bg-background-tertiary text-primary"
                          : "text-text-primary"
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="truncate">{prop.label}</span>
                        {prop.supportedTrackTypes && (
                          <div className="flex gap-0.5 flex-shrink-0">
                            {prop.supportedTrackTypes.map((type) => (
                              <span
                                key={type}
                                className="text-[7px] px-1 py-0.5 rounded bg-background-secondary text-text-muted uppercase font-medium"
                                title={`Works with ${type} tracks`}
                              >
                                {type[0]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {hasKeyframes && (
                        <Diamond
                          size={10}
                          className="text-primary fill-primary flex-shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const EasingCurvePreview: React.FC<{ easing: string; size?: number }> = ({
  easing,
  size = 16,
}) => {
  const getPath = (easingType: string): string => {
    const easingPaths: Record<string, string> = {
      linear: "M0,16 L16,0",
      easeIn: "M0,16 Q8,16 16,0",
      easeOut: "M0,16 Q8,0 16,0",
      easeInOut: "M0,16 Q4,16 8,8 Q12,0 16,0",
      easeInQuad: "M0,16 C0,16 12,16 16,0",
      easeOutQuad: "M0,16 C4,0 16,0 16,0",
      easeInOutQuad: "M0,16 C0,16 6,16 8,8 C10,0 16,0 16,0",
      easeInCubic: "M0,16 C0,16 14,16 16,0",
      easeOutCubic: "M0,16 C2,0 16,0 16,0",
      easeInOutCubic: "M0,16 C0,16 5,16 8,8 C11,0 16,0 16,0",
      easeInElastic: "M0,16 Q2,18 4,16 Q6,14 8,16 Q12,8 16,0",
      easeOutElastic: "M0,16 Q4,8 8,0 Q10,2 12,0 Q14,-2 16,0",
      easeInBounce: "M0,16 L4,16 L6,14 L8,16 L12,8 L16,0",
      easeOutBounce: "M0,16 L4,8 L8,0 L10,2 L12,0 L14,2 L16,0",
    };
    return easingPaths[easingType] || easingPaths.linear;
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className="text-primary"
    >
      <path
        d={getPath(easing)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};

const EasingSelector: React.FC<{
  value: EasingType;
  onChange: (easing: EasingName) => void;
}> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentLabel = formatEasingLabel(value);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 bg-background-tertiary border border-border rounded text-[9px] text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors"
        title={`Easing: ${currentLabel}`}
      >
        <EasingCurvePreview easing={value} size={14} />
        <span>{currentLabel}</span>
        <ChevronDown size={10} />
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 bg-background-secondary border border-border rounded-lg shadow-lg z-20 min-w-[160px] max-h-64 overflow-y-auto">
            {EASING_CATEGORIES.map((category) => (
              <div key={category.name}>
                <div className="px-3 py-1 text-[8px] font-medium text-text-muted uppercase tracking-wider bg-background-tertiary sticky top-0">
                  {category.name}
                </div>
                {category.easings.map((easing) => (
                  <button
                    key={easing}
                    onClick={() => {
                      onChange(easing);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-[10px] hover:bg-background-tertiary transition-colors flex items-center gap-2 ${
                      value === easing ? "text-primary" : "text-text-primary"
                    }`}
                  >
                    <EasingCurvePreview easing={easing} size={14} />
                    {formatEasingLabel(easing)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const KeyframeItem: React.FC<{
  keyframe: Keyframe;
  onUpdate: (updates: Partial<Omit<Keyframe, "id">>) => void;
  onDelete: () => void;
  onEasingChange: (easing: EasingName) => void;
  property: AnimatableProperty | undefined;
  clipStartTime: number;
}> = ({ keyframe, onUpdate, onDelete, onEasingChange, property, clipStartTime }) => {
  const _formatValue = (value: unknown): string => {
    if (typeof value === "number") {
      return value.toFixed(property?.step && property.step < 1 ? 2 : 0);
    }
    return String(value);
  };
  void _formatValue;

  return (
    <div className="flex items-center gap-2 p-2 bg-background-tertiary rounded-lg border border-border">
      <DiamondIcon
        size={12}
        className="text-primary fill-primary flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-secondary" title="Timeline position">
            {(clipStartTime + keyframe.time).toFixed(2)}s
          </span>
          <span className="text-[10px] text-text-muted">•</span>
          <input
            type="number"
            value={typeof keyframe.value === "number" ? keyframe.value : 0}
            onChange={(e) =>
              onUpdate({ value: parseFloat(e.target.value) || 0 })
            }
            min={property?.min}
            max={property?.max}
            step={property?.step || 1}
            className="w-16 text-[10px] font-mono text-text-primary bg-background-secondary px-1.5 py-0.5 rounded border border-border outline-none focus:border-primary"
          />
        </div>
      </div>
      <EasingSelector value={keyframe.easing} onChange={onEasingChange} />
      <button
        onClick={onDelete}
        className="p-1 hover:bg-red-500/20 rounded transition-colors text-text-muted hover:text-red-400"
        title="Delete keyframe"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

interface KeyframesSectionProps {
  clipId: string;
}

/**
 * KeyframesSection Component
 *
 * - 20.1: Add keyframes at specific times with values
 * - 20.2: Select easing type for keyframe interpolation
 */
export const KeyframesSection: React.FC<KeyframesSectionProps> = ({
  clipId,
}) => {
  const { getClip, updateClipKeyframes, project } = useProjectStore();
  const playheadPosition = useTimelineStore((state) => state.playheadPosition);
  const getGraphicsEngine = useEngineStore((state) => state.getGraphicsEngine);
  const getTitleEngine = useEngineStore((state) => state.getTitleEngine);

  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [keyframesMigrated, setKeyframesMigrated] = useState(false);

  // Check for property selection from keyframe click in timeline
  useEffect(() => {
    const checkSessionStorage = () => {
      const storedProperty = sessionStorage.getItem('openreel_selected_keyframe_property');
      if (storedProperty) {
        setSelectedProperty(storedProperty);
        sessionStorage.removeItem('openreel_selected_keyframe_property');
      }
    };
    
    // Check immediately
    checkSessionStorage();
    
    // Also check periodically for a short time in case of timing issues
    const interval = setInterval(checkSessionStorage, 100);
    const timeout = setTimeout(() => clearInterval(interval), 1000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [clipId]);

  const clip = useMemo(() => {
    const timelineClip = getClip(clipId);
    if (timelineClip) return timelineClip;

    const graphicsEngine = getGraphicsEngine();
    const svgClip = graphicsEngine?.getSVGClip(clipId);
    if (svgClip) return svgClip;

    const shapeClip = graphicsEngine?.getShapeClip(clipId);
    if (shapeClip) return shapeClip;

    const stickerClip = graphicsEngine?.getStickerClip(clipId);
    if (stickerClip) return stickerClip;

    const titleEngine = getTitleEngine();
    const textClip = titleEngine?.getTextClip(clipId);
    if (textClip) return textClip;

    return undefined;
  }, [clipId, getClip, getGraphicsEngine, getTitleEngine, project.modifiedAt]);
  
  // Migrate old absolute-time keyframes to clip-local time (backward compatibility)
  useEffect(() => {
    if (!clip || keyframesMigrated || !clip.keyframes || clip.keyframes.length === 0) return;
    
    const clipStartTime = clip.startTime || 0;
    let needsMigration = false;
    
    // Check if any keyframes appear to be in absolute time (time >= clipStartTime)
    // This heuristic detects old keyframes that were stored as absolute timeline positions
    const migratedKeyframes = clip.keyframes.map(kf => {
      // If keyframe time is significantly larger than what we'd expect for clip-local time,
      // and it's close to an absolute timeline position, migrate it
      if (kf.time >= clipStartTime && clipStartTime > 0) {
        needsMigration = true;
        return { ...kf, time: kf.time - clipStartTime };
      }
      return kf;
    });
    
    if (needsMigration) {
      console.log(`[KeyframesSection] Migrating ${clip.keyframes.length} keyframes from absolute to clip-local time for clip ${clipId}`);
      updateClipKeyframes(clipId, migratedKeyframes);
    }
    
    setKeyframesMigrated(true);
  }, [clip, clipId, updateClipKeyframes, keyframesMigrated]);
  
  const keyframes = clip?.keyframes || [];

  const propertiesWithKeyframes = useMemo(() => {
    return [...new Set(keyframes.map((kf) => kf.property))];
  }, [keyframes]);

  const propertyKeyframes = useMemo(() => {
    if (!selectedProperty) return [];
    return keyframeEngine.getKeyframesForProperty(keyframes, selectedProperty);
  }, [keyframes, selectedProperty]);

  const propertyDef = useMemo(() => {
    return ANIMATABLE_PROPERTIES.find((p) => p.id === selectedProperty);
  }, [selectedProperty]);

  const currentValue = useMemo(() => {
    if (!selectedProperty || propertyKeyframes.length === 0) {
      return propertyDef?.defaultValue ?? 0;
    }
    // Convert absolute timeline time to clip-local time for interpolation
    const clipLocalTime = playheadPosition - (clip?.startTime || 0);
    const result = keyframeEngine.getValueAtTime(
      propertyKeyframes,
      clipLocalTime,
    );
    return result.value;
  }, [selectedProperty, propertyKeyframes, playheadPosition, propertyDef, clip]);

  const hasKeyframeAtPlayhead = useMemo(() => {
    if (!selectedProperty) return false;
    // Convert absolute timeline time to clip-local time
    const clipLocalTime = playheadPosition - (clip?.startTime || 0);
    return propertyKeyframes.some(
      (kf) => Math.abs(kf.time - clipLocalTime) < 0.01,
    );
  }, [selectedProperty, propertyKeyframes, playheadPosition, clip]);

  const handleAddKeyframe = useCallback(() => {
    if (!selectedProperty || !clip) return;

    // Convert absolute timeline time to clip-local time
    const clipLocalTime = playheadPosition - (clip.startTime || 0);

    const newKeyframe = keyframeEngine.addKeyframe(
      clipId,
      selectedProperty,
      clipLocalTime,
      currentValue,
      "linear",
    );

    const updatedKeyframes = [...keyframes, newKeyframe].sort(
      (a, b) => a.time - b.time,
    );
    updateClipKeyframes(clipId, updatedKeyframes);
  }, [
    clipId,
    clip,
    selectedProperty,
    playheadPosition,
    currentValue,
    keyframes,
    updateClipKeyframes,
  ]);

  const handleUpdateKeyframe = useCallback(
    (keyframeId: string, updates: Partial<Omit<Keyframe, "id">>) => {
      const updatedKeyframes = keyframeEngine.updateKeyframe(
        keyframes,
        keyframeId,
        updates,
      );
      updateClipKeyframes(clipId, updatedKeyframes);
    },
    [clipId, keyframes, updateClipKeyframes],
  );

  const handleDeleteKeyframe = useCallback(
    (keyframeId: string) => {
      const updatedKeyframes = keyframeEngine.removeKeyframe(
        keyframes,
        keyframeId,
      );
      updateClipKeyframes(clipId, updatedKeyframes);
    },
    [clipId, keyframes, updateClipKeyframes],
  );

  const handleEasingChange = useCallback(
    (keyframeId: string, easing: EasingName) => {
      const updatedKeyframes = keyframeEngine.updateKeyframe(
        keyframes,
        keyframeId,
        { easing: easing as EasingType },
      );
      updateClipKeyframes(clipId, updatedKeyframes);
    },
    [clipId, keyframes, updateClipKeyframes],
  );

  if (!clip) {
    return (
      <div className="text-[10px] text-text-muted text-center py-4">
        No clip selected
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[10px] text-text-secondary font-medium">
          Animate Property
        </label>
        <PropertySelector
          selectedProperty={selectedProperty}
          onSelect={setSelectedProperty}
          existingProperties={propertiesWithKeyframes}
        />
      </div>

      {selectedProperty && (
        <div className="flex items-center justify-between p-2 bg-background-tertiary rounded-lg border border-border">
          <span className="text-[10px] text-text-secondary">
            Value at {playheadPosition.toFixed(2)}s
          </span>
          <span className="text-[10px] font-mono text-text-primary">
            {typeof currentValue === "number"
              ? currentValue.toFixed(2)
              : String(currentValue)}
          </span>
        </div>
      )}

      {selectedProperty && (
        <button
          onClick={handleAddKeyframe}
          disabled={hasKeyframeAtPlayhead}
          className={`w-full py-2 rounded-lg text-[10px] flex items-center justify-center gap-2 transition-colors ${
            hasKeyframeAtPlayhead
              ? "bg-background-tertiary border border-border text-text-muted cursor-not-allowed"
              : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
          }`}
        >
          {hasKeyframeAtPlayhead ? (
            <>
              <Key size={12} />
              Keyframe exists at {playheadPosition.toFixed(2)}s
            </>
          ) : (
            <>
              <Plus size={12} />
              Add Keyframe at {playheadPosition.toFixed(2)}s
            </>
          )}
        </button>
      )}

      {selectedProperty && propertyKeyframes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-secondary font-medium">
              Keyframes ({propertyKeyframes.length})
            </span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-visible">
            {propertyKeyframes.map((kf) => (
              <KeyframeItem
                key={kf.id}
                keyframe={kf}
                property={propertyDef}
                clipStartTime={clip?.startTime || 0}
                onUpdate={(updates) => handleUpdateKeyframe(kf.id, updates)}
                onDelete={() => handleDeleteKeyframe(kf.id)}
                onEasingChange={(easing) => handleEasingChange(kf.id, easing)}
              />
            ))}
          </div>
        </div>
      )}

      {!selectedProperty && (
        <div className="text-center py-4">
          <Key size={24} className="mx-auto text-text-muted mb-2" />
          <p className="text-[10px] text-text-muted">
            Select a property to animate
          </p>
        </div>
      )}

      {selectedProperty && propertyKeyframes.length === 0 && (
        <p className="text-[10px] text-text-muted text-center py-2">
          No keyframes for this property. Add one to start animating.
        </p>
      )}
    </div>
  );
};

export default KeyframesSection;
