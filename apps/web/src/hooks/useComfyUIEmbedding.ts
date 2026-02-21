import { useEffect, useRef } from "react";
import { useProjectStore } from "../stores/project-store";
import { useThemeStore } from "../stores/theme-store";
import { useRouter } from "./use-router";

interface ComfyUIEmbeddingOptions {
  enabled: boolean;
}

/**
 * Hook for ComfyUI_Viewer embedding integration.
 *
 * When enabled (?embedded=true):
 * - Creates a new project and navigates to editor on mount
 * - Auto-imports video from the video_url query param
 * - Applies ComfyUI host theme colors to match the parent UI
 * - Notifies parent iframe when ready
 * - Listens for postMessage commands from parent
 */
export function useComfyUIEmbedding({ enabled }: ComfyUIEmbeddingOptions) {
  const { createNewProject, importMedia } = useProjectStore();
  const { setMode } = useThemeStore();
  const { navigate } = useRouter();
  const hasInitialized = useRef(false);
  const lastImportedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || hasInitialized.current) return;
    hasInitialized.current = true;

    const params = new URLSearchParams(window.location.search);
    const fps = parseInt(params.get("fps") || "24", 10);

    // Apply ComfyUI theme before anything renders
    applyComfyUITheme(params, setMode);

    // Create a new project and go straight to editor.
    // Video/audio is NOT loaded from URL params — it arrives via postMessage
    // from the parent (comfy_viewer.js) when the workflow executes.
    createNewProject("ComfyUI Video", {
      width: 1920,
      height: 1080,
      frameRate: fps,
    });
    navigate("editor");

    // Notify parent that we're ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: "openreel-ready" }, "*");
    }
  }, [enabled, createNewProject, navigate, importMedia, setMode]);

  // Listen for messages from parent iframe
  useEffect(() => {
    if (!enabled) return;

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || !event.data.type) return;

      // Parent sends video/audio URL to import when the workflow executes
      if (event.data.type === "comfyui-import-video") {
        const url = event.data.url || event.data.audioUrl;
        if (url && url !== lastImportedUrl.current) {
          lastImportedUrl.current = url;
          if (event.data.url) {
            autoImportVideo(event.data.url, importMedia);
          } else if (event.data.audioUrl) {
            autoImportAudio(event.data.audioUrl, importMedia);
          }
        }
      }

      // Parent sends individual image URLs to import as image clips
      if (event.data.type === "comfyui-import-images") {
        const imageUrls: string[] = event.data.imageUrls || [];
        const cacheKey = imageUrls.join("|");
        if (cacheKey && cacheKey !== lastImportedUrl.current) {
          lastImportedUrl.current = cacheKey;
          autoImportImages(imageUrls, importMedia);
        }
      }

      // Parent sends combined imports (multiple asset types at once)
      if (event.data.type === "comfyui-import-combined") {
        const imports: Array<{ type: string; [key: string]: unknown }> =
          event.data.imports || [];
        const cacheKey = JSON.stringify(imports);
        if (cacheKey && cacheKey !== lastImportedUrl.current) {
          lastImportedUrl.current = cacheKey;
          autoImportCombined(imports, importMedia);
        }
      }

      // Parent can send updated theme colors
      if (event.data.type === "comfyui-theme-update" && event.data.theme) {
        const themeParams = new URLSearchParams();
        for (const [key, value] of Object.entries(event.data.theme)) {
          themeParams.set(key, value as string);
        }
        applyComfyUITheme(themeParams, setMode);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [enabled, importMedia, setMode]);
}

// ---------------------------------------------------------------------------
// ComfyUI Theme Integration
// ---------------------------------------------------------------------------

/**
 * Parse a CSS color string (hex, rgb(), named) into [r, g, b] 0-255.
 * Returns null if parsing fails.
 */
function parseColor(color: string): [number, number, number] | null {
  if (!color) return null;
  const c = color.trim();

  // #rgb / #rrggbb
  const hexMatch = c.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    if (hex.length >= 6) {
      return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
    }
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
  }

  return null;
}

/** Convert [r,g,b] to "r g b" triplet string for OpenReel --color-* vars */
function toRgbTriplet(rgb: [number, number, number]): string {
  return `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
}

/** Convert [r,g,b] to "h s% l%" HSL string for shadcn CSS vars */
function toHsl(rgb: [number, number, number]): string {
  const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Perceived luminance 0-1 */
function luminance(rgb: [number, number, number]): number {
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
}

/** Lighten or darken an RGB color by a factor (-1..1) */
function adjustBrightness(rgb: [number, number, number], factor: number): [number, number, number] {
  if (factor > 0) {
    return [
      Math.min(255, Math.round(rgb[0] + (255 - rgb[0]) * factor)),
      Math.min(255, Math.round(rgb[1] + (255 - rgb[1]) * factor)),
      Math.min(255, Math.round(rgb[2] + (255 - rgb[2]) * factor)),
    ];
  }
  return [
    Math.max(0, Math.round(rgb[0] * (1 + factor))),
    Math.max(0, Math.round(rgb[1] * (1 + factor))),
    Math.max(0, Math.round(rgb[2] * (1 + factor))),
  ];
}

/**
 * Read ComfyUI theme colors from query params and override OpenReel CSS variables.
 * Also sets dark/light mode based on background luminance.
 */
function applyComfyUITheme(
  params: URLSearchParams,
  setMode: (mode: "light" | "dark" | "auto") => void,
) {
  const bgStr = params.get("theme_bg");
  if (!bgStr) return; // No theme provided

  const bg = parseColor(bgStr);
  if (!bg) return;

  const isDark = luminance(bg) < 0.5;
  setMode(isDark ? "dark" : "light");

  // Parse all available theme colors, deriving missing ones from bg
  const bgSecondary = parseColor(params.get("theme_bg_secondary") || "") || adjustBrightness(bg, isDark ? 0.06 : -0.03);
  const bgTertiary = parseColor(params.get("theme_bg_tertiary") || "") || adjustBrightness(bg, isDark ? 0.12 : -0.06);
  const bgElevated = adjustBrightness(bg, isDark ? 0.22 : -0.12);
  const fg = parseColor(params.get("theme_fg") || "") || (isDark ? [224,224,224] as [number,number,number] : [24,24,27] as [number,number,number]);
  const fgMuted = parseColor(params.get("theme_fg_muted") || "") || adjustBrightness(fg, isDark ? -0.35 : 0.35);
  const fgSecondary = adjustBrightness(fg, isDark ? -0.2 : 0.2);
  const border = parseColor(params.get("theme_border") || "") || adjustBrightness(bg, isDark ? 0.15 : -0.1);
  const borderHover = adjustBrightness(border, isDark ? 0.12 : -0.08);
  const borderActive = adjustBrightness(border, isDark ? 0.25 : -0.18);
  const accent = parseColor(params.get("theme_accent") || "") || [74, 158, 255];
  const inputBg = parseColor(params.get("theme_input_bg") || "") || bgTertiary;
  const scrollThumb = parseColor(params.get("theme_scrollbar_thumb") || "") || borderHover;
  const scrollTrack = parseColor(params.get("theme_scrollbar_track") || "") || bg;

  // Derive shadcn HSL values
  const accentHsl = toHsl(accent);
  const bgHsl = toHsl(bg);
  const fgHsl = toHsl(fg);
  const cardBg = bgSecondary;
  const cardHsl = toHsl(cardBg);
  const mutedBg = bgTertiary;
  const mutedHsl = toHsl(mutedBg);
  const borderHsl = toHsl(border);
  const inputHsl = toHsl(inputBg);

  // Build CSS overrides
  const css = `
    :root, .dark {
      /* OpenReel custom color overrides (RGB triplets) */
      --color-background: ${toRgbTriplet(bg)};
      --color-background-secondary: ${toRgbTriplet(bgSecondary)};
      --color-background-tertiary: ${toRgbTriplet(bgTertiary)};
      --color-background-elevated: ${toRgbTriplet(bgElevated)};
      --color-text-primary: ${toRgbTriplet(fg)};
      --color-text-secondary: ${toRgbTriplet(fgSecondary)};
      --color-text-muted: ${toRgbTriplet(fgMuted)};
      --color-border: ${toRgbTriplet(border)};
      --color-border-hover: ${toRgbTriplet(borderHover)};
      --color-border-active: ${toRgbTriplet(borderActive)};

      /* shadcn/ui CSS variable overrides (HSL) */
      --background: ${bgHsl};
      --foreground: ${fgHsl};
      --card: ${cardHsl};
      --card-foreground: ${fgHsl};
      --popover: ${cardHsl};
      --popover-foreground: ${fgHsl};
      --primary: ${accentHsl};
      --primary-foreground: 0 0% 100%;
      --secondary: ${mutedHsl};
      --secondary-foreground: ${fgHsl};
      --muted: ${mutedHsl};
      --muted-foreground: ${toHsl(fgMuted)};
      --accent: ${mutedHsl};
      --accent-foreground: ${fgHsl};
      --border: ${borderHsl};
      --input: ${inputHsl};
      --ring: ${accentHsl};

      color-scheme: ${isDark ? "dark" : "light"};
      color: rgb(${toRgbTriplet(fg)});
      background-color: rgb(${toRgbTriplet(bg)});
    }

    /* Scrollbar overrides */
    ::-webkit-scrollbar-thumb {
      background: rgb(${toRgbTriplet(scrollThumb)}) !important;
    }
    ::-webkit-scrollbar-track {
      background: rgb(${toRgbTriplet(scrollTrack)}) !important;
    }
  `;

  // Inject or update the style element
  let styleEl = document.getElementById("comfyui-theme-override") as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "comfyui-theme-override";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;

  console.log("[ComfyUI Embedding] Applied theme:", isDark ? "dark" : "light");
}

// ---------------------------------------------------------------------------
// Auto-import helpers
// ---------------------------------------------------------------------------

async function autoImportVideo(
  videoUrl: string,
  importMedia: (file: File) => Promise<{ success: boolean; error?: { message: string } }>,
  index = 0,
) {
  try {
    console.log("[ComfyUI Embedding] Fetching video from:", videoUrl);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      console.error("[ComfyUI Embedding] Failed to fetch video:", response.status);
      return;
    }

    const blob = await response.blob();
    const filename = `comfyui_video_${String(index).padStart(4, "0")}.mp4`;
    const file = new File([blob], filename, { type: "video/mp4" });

    console.log("[ComfyUI Embedding] Importing video, size:", blob.size);
    const result = await importMedia(file);

    if (result.success) {
      console.log("[ComfyUI Embedding] Video imported successfully");
    } else {
      console.error("[ComfyUI Embedding] Video import failed:", result.error?.message);
    }
  } catch (error) {
    console.error("[ComfyUI Embedding] Error importing video:", error);
  }
}

async function autoImportImages(
  imageUrls: string[],
  importMedia: (file: File) => Promise<{ success: boolean; error?: { message: string } }>,
) {
  try {
    console.log(`[ComfyUI Embedding] Importing ${imageUrls.length} images`);
    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`[ComfyUI Embedding] Failed to fetch image ${i}:`, response.status);
          continue;
        }

        const blob = await response.blob();
        const filename = `comfyui_image_${String(i).padStart(4, "0")}.png`;
        const file = new File([blob], filename, { type: "image/png" });

        const result = await importMedia(file);
        if (result.success) {
          console.log(`[ComfyUI Embedding] Image ${i} imported successfully`);
        } else {
          console.error(`[ComfyUI Embedding] Image ${i} import failed:`, result.error?.message);
        }
      } catch (error) {
        console.error(`[ComfyUI Embedding] Error importing image ${i}:`, error);
      }
    }
    console.log(`[ComfyUI Embedding] Finished importing ${imageUrls.length} images`);
  } catch (error) {
    console.error("[ComfyUI Embedding] Error importing images:", error);
  }
}

async function autoImportCombined(
  imports: Array<{ type: string; [key: string]: unknown }>,
  importMedia: (file: File) => Promise<{ success: boolean; error?: { message: string } }>,
) {
  console.log(`[ComfyUI Embedding] Processing combined import with ${imports.length} entries`);
  let videoIndex = 0;
  let audioIndex = 0;
  for (const entry of imports) {
    if (entry.type === "comfyui-import-video") {
      if (entry.url) {
        await autoImportVideo(entry.url as string, importMedia, videoIndex++);
      } else if (entry.audioUrl) {
        await autoImportAudio(entry.audioUrl as string, importMedia, audioIndex++);
      }
    } else if (entry.type === "comfyui-import-images") {
      const imageUrls = (entry.imageUrls as string[]) || [];
      if (imageUrls.length > 0) {
        await autoImportImages(imageUrls, importMedia);
      }
    }
  }
  console.log("[ComfyUI Embedding] Combined import complete");
}

async function autoImportAudio(
  audioUrl: string,
  importMedia: (file: File) => Promise<{ success: boolean; error?: { message: string } }>,
  index = 0,
) {
  try {
    console.log("[ComfyUI Embedding] Fetching audio from:", audioUrl);
    const response = await fetch(audioUrl);
    if (!response.ok) {
      console.error("[ComfyUI Embedding] Failed to fetch audio:", response.status);
      return;
    }

    const blob = await response.blob();
    const filename = `comfyui_audio_${String(index).padStart(4, "0")}.wav`;
    const file = new File([blob], filename, { type: "audio/wav" });

    console.log("[ComfyUI Embedding] Importing audio, size:", blob.size);
    const result = await importMedia(file);

    if (result.success) {
      console.log("[ComfyUI Embedding] Audio imported successfully");
    } else {
      console.error("[ComfyUI Embedding] Audio import failed:", result.error?.message);
    }
  } catch (error) {
    console.error("[ComfyUI Embedding] Error importing audio:", error);
  }
}
