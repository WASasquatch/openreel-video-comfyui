import React, { useState, useCallback } from "react";
import {
  Smartphone,
  Monitor,
  Square,
  Loader2,
  Play,
  CheckCircle,
} from "lucide-react";
import { Slider } from "@openreel/ui";
import {
  type ReframeSettings,
  type AspectRatioPreset,
  type PlatformPreset,
  type ReframeResult,
  ASPECT_RATIO_PRESETS,
  PLATFORM_PRESETS,
  DEFAULT_REFRAME_SETTINGS,
} from "@openreel/core";
import { toast } from "../../../stores/notification-store";
import { useProjectStore } from "../../../stores/project-store";

interface AutoReframeSectionProps {
  clipId: string;
  onReframeComplete?: (result: ReframeResult) => void;
}

const PLATFORM_ICONS: Record<PlatformPreset, React.ReactNode> = {
  youtube: <Monitor size={14} />,
  tiktok: <Smartphone size={14} />,
  "instagram-reels": <Smartphone size={14} />,
  "instagram-feed": <Square size={14} />,
  "instagram-stories": <Smartphone size={14} />,
  "youtube-shorts": <Smartphone size={14} />,
  facebook: <Monitor size={14} />,
  twitter: <Monitor size={14} />,
  linkedin: <Monitor size={14} />,
};

export const AutoReframeSection: React.FC<AutoReframeSectionProps> = ({
  onReframeComplete,
}) => {
  const updateProjectDimensions = useProjectStore(
    (state) => state.updateSettings,
  );
  const [reframeSettings, setReframeSettings] = useState<ReframeSettings>(
    DEFAULT_REFRAME_SETTINGS,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [selectedPlatform, setSelectedPlatform] =
    useState<PlatformPreset | null>("tiktok");

  const updateLocalSettings = useCallback(
    (updates: Partial<ReframeSettings>) => {
      setReframeSettings((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  const handleSelectPlatform = useCallback(
    (platform: PlatformPreset) => {
      setSelectedPlatform(platform);
      const config = PLATFORM_PRESETS[platform];
      const aspectRatio = Object.entries(ASPECT_RATIO_PRESETS).find(
        ([, v]) => Math.abs(v.ratio - config.ratio) < 0.01,
      );
      if (aspectRatio) {
        updateLocalSettings({
          targetAspectRatio: aspectRatio[0] as AspectRatioPreset,
        });
      }
    },
    [updateLocalSettings],
  );

  const handleSelectAspectRatio = useCallback(
    (ratio: AspectRatioPreset) => {
      setSelectedPlatform(null);
      updateLocalSettings({ targetAspectRatio: ratio });
    },
    [updateLocalSettings],
  );

  const handleApplySize = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0);
    setProgressMessage("Updating canvas size...");

    try {
      const targetConfig =
        ASPECT_RATIO_PRESETS[reframeSettings.targetAspectRatio];

      console.log('[AutoReframe] Applying canvas size:', {
        targetAspectRatio: reframeSettings.targetAspectRatio,
        targetConfig,
        newDimensions: { width: targetConfig.width, height: targetConfig.height }
      });

      setProgress(50);

      const updateResult = await updateProjectDimensions({
        width: targetConfig.width,
        height: targetConfig.height,
      });

      console.log('[AutoReframe] Update result:', updateResult);

      setProgress(100);
      setProgressMessage("Complete!");
      setIsApplied(true);

      const reframeResult: ReframeResult = {
        keyframes: [],
        outputWidth: targetConfig.width,
        outputHeight: targetConfig.height,
        success: true,
        message: `Canvas resized to ${targetConfig.name} (${targetConfig.width}x${targetConfig.height})`,
      };

      onReframeComplete?.(reframeResult);

      const platformName = selectedPlatform
        ? PLATFORM_PRESETS[selectedPlatform].name
        : reframeSettings.targetAspectRatio;
      toast.success(
        "Canvas Resized",
        `Project output size changed to ${platformName} (${targetConfig.width}x${targetConfig.height})`,
      );
    } catch (error) {
      console.error("Canvas resize failed:", error);
      toast.error(
        "Resize Failed",
        error instanceof Error ? error.message : "Unknown error",
      );
      setIsApplied(false);
    } finally {
      setIsProcessing(false);
    }
  }, [
    reframeSettings,
    selectedPlatform,
    onReframeComplete,
    updateProjectDimensions,
  ]);

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-text-secondary block mb-2">
            Platform Presets
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(Object.keys(PLATFORM_PRESETS) as PlatformPreset[]).map(
              (platform) => (
                <button
                  key={platform}
                  onClick={() => handleSelectPlatform(platform)}
                  className={`flex items-center gap-1 p-2 rounded text-[9px] transition-colors ${
                    selectedPlatform === platform
                      ? "bg-primary/20 border border-primary text-text-primary"
                      : "bg-background-secondary hover:bg-background-primary border border-transparent text-text-secondary"
                  }`}
                >
                  {PLATFORM_ICONS[platform]}
                  <span className="truncate">
                    {PLATFORM_PRESETS[platform].name}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-text-secondary block mb-2">
            Aspect Ratio
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(Object.keys(ASPECT_RATIO_PRESETS) as AspectRatioPreset[])
              .filter((r) => r !== "custom")
              .map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => handleSelectAspectRatio(ratio)}
                  className={`p-2 rounded text-[9px] transition-colors ${
                    reframeSettings.targetAspectRatio === ratio &&
                    !selectedPlatform
                      ? "bg-primary/20 border border-primary text-text-primary"
                      : "bg-background-secondary hover:bg-background-primary border border-transparent text-text-secondary"
                  }`}
                >
                  {ratio}
                </button>
              ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-text-secondary">
              Tracking Speed
            </label>
            <span className="text-[10px] text-text-muted font-mono">
              {Math.round(reframeSettings.trackingSpeed * 100)}%
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[reframeSettings.trackingSpeed * 100]}
            onValueChange={(value) =>
              updateLocalSettings({
                trackingSpeed: value[0] / 100,
              })
            }
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-text-secondary">Smoothing</label>
            <span className="text-[10px] text-text-muted font-mono">
              {Math.round(reframeSettings.smoothing * 100)}%
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[reframeSettings.smoothing * 100]}
            onValueChange={(value) =>
              updateLocalSettings({ smoothing: value[0] / 100 })
            }
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-text-secondary">
              Center Bias
            </label>
            <span className="text-[10px] text-text-muted font-mono">
              {Math.round(reframeSettings.centerBias * 100)}%
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[reframeSettings.centerBias * 100]}
            onValueChange={(value) =>
              updateLocalSettings({
                centerBias: value[0] / 100,
              })
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-[10px] text-text-secondary">
            Follow Subject
          </label>
          <button
            onClick={() =>
              updateLocalSettings({
                followSubject: !reframeSettings.followSubject,
              })
            }
            className={`w-8 h-4 rounded-full transition-colors ${
              reframeSettings.followSubject
                ? "bg-primary"
                : "bg-background-secondary"
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full bg-white transition-transform ${
                reframeSettings.followSubject
                  ? "translate-x-4"
                  : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {isProcessing && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-text-muted">
                {progressMessage}
              </span>
              <span className="text-[9px] text-text-muted">{progress}%</span>
            </div>
            <div className="h-1 bg-background-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleApplySize}
          disabled={isProcessing}
          className="w-full py-2 rounded text-[11px] font-medium transition-colors flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white"
        >
          {isProcessing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Resizing Canvas...
            </>
          ) : isApplied ? (
            <>
              <CheckCircle size={14} />
              Applied - Click to Change Again
            </>
          ) : (
            <>
              <Play size={14} />
              Apply Canvas Size
            </>
          )}
        </button>

        <div className="text-[9px] text-text-muted text-center">
          Output:{" "}
          {ASPECT_RATIO_PRESETS[reframeSettings.targetAspectRatio].width} x{" "}
          {ASPECT_RATIO_PRESETS[reframeSettings.targetAspectRatio].height}
        </div>
      </div>
    </div>
  );
};

export default AutoReframeSection;
