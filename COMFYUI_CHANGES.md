# ComfyUI-Specific Modifications

This fork of OpenReel contains modifications for seamless integration with ComfyUI_Viewer_OpenReel_Extension.

## Key Changes from Upstream OpenReel

### 1. Vite Base Path Configuration
**File:** `apps/web/vite.config.ts:9`
```typescript
base: "/was/openreel_video/app/"
```
**Purpose:** Ensures all asset paths (JS chunks, CSS, workers) resolve correctly when served under ComfyUI's `/was/openreel_video/app/` route.

### 2. Static Import (No Lazy Loading)
**File:** `apps/web/src/App.tsx:16`
```typescript
import { EditorInterface } from "./components/editor/EditorInterface";
```
**Purpose:** Changed from `React.lazy()` to static import to prevent reload loops in ComfyUI iframe context. Dynamic imports consistently failed on hard refresh inside the iframe.

### 3. ComfyUI Embedding Hook
**File:** `apps/web/src/hooks/useComfyUIEmbedding.ts`
**Purpose:** Handles `comfyui-import-video` postMessage events for video content injection from ComfyUI workflows. Allows the iframe to load once and receive video data dynamically without reloading.

### 4. Error Handler Embedded Mode Check
**File:** `apps/web/src/lib/error-handler.ts`
**Purpose:** Skips `window.location.reload()` when `embedded=true` query parameter is present to prevent reload loops in iframe context.

### 5. Blend Modes & Opacity Support
**Files:**
- `apps/web/src/components/editor/Preview.tsx` - Multi-clip rendering for overlapping clips
- `apps/web/src/components/editor/preview/canvas-renderers.ts` - Blend mode parameter support
- `packages/core/src/video/video-engine.ts` - Video engine blend mode support

**Purpose:** Enables proper rendering of blend modes (Multiply, Screen, Overlay) and opacity during both paused preview and video playback. Removed overlap check that disabled native playback, rewrote rendering to handle all active clips at current time.

## Building for ComfyUI_Viewer_OpenReel_Extension

```bash
# Install dependencies
pnpm install

# Build the app
pnpm build

# Output will be in apps/web/dist/
# Copy to extension:
rm -rf ../ComfyUI_Viewer_OpenReel_Extension/apps/openreel_app/assets
cp -r apps/web/dist/* ../ComfyUI_Viewer_OpenReel_Extension/apps/openreel_app/
```

## Syncing with Upstream

To merge updates from upstream OpenReel:

```bash
# Add upstream remote (one time)
git remote add upstream https://github.com/augani/openreel.git

# Fetch and merge
git fetch upstream
git merge upstream/main

# Resolve conflicts - KEEP these ComfyUI-specific changes:
# - vite.config.ts base path
# - App.tsx static imports
# - useComfyUIEmbedding hook
# - error-handler.ts embedded check
# - Blend mode changes in Preview.tsx and canvas-renderers.ts
```

## Testing Changes

### Local Development
```bash
pnpm dev
# Opens on http://localhost:5173
# Test with ?embedded=true&theme_bg=%231a1a2e&theme_fg=%23e0e0e0
```

### In ComfyUI
1. Build the app: `pnpm build`
2. Copy to extension's `apps/openreel_app/`
3. Restart ComfyUI
4. Test with CV OpenReel Import Video or Bundle Video nodes

## Architecture Notes

### PostMessage Protocol
- **ComfyUI → OpenReel**: `comfyui-import-video` with video URL, audio URL, fps, sessionId
- **OpenReel → ComfyUI**: `openreel-video-output` with exported filename

### Iframe Loading Strategy
- Iframe loads ONCE with stable URL (embedded=true + theme params only)
- Video content sent via postMessage when workflow executes
- No reload on content changes (prevents reload loops)

### Theme Synchronization
OpenReel reads ComfyUI theme colors from URL parameters:
- `theme_bg`, `theme_fg`, `theme_border`, `theme_accent` (basic)
- `theme_bg_secondary`, `theme_bg_tertiary`, `theme_fg_muted` (extended)
- `theme_input_bg`, `theme_scrollbar_thumb`, `theme_scrollbar_track` (UI)

## Repository Structure

```
openreel-video-comfyui/
├── apps/
│   ├── web/                    # Main React app (ComfyUI integration here)
│   └── image/                  # Image editor (not used by ComfyUI)
├── packages/
│   ├── core/                   # Video engine, effects, timeline
│   └── ui/                     # Shared UI components
├── .gitignore                  # Excludes node_modules, dist, build
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # pnpm monorepo config
└── COMFYUI_CHANGES.md          # This file
```

## Maintenance

- **Keep changes minimal**: Only modify what's necessary for ComfyUI integration
- **Document all changes**: Update this file when making ComfyUI-specific modifications
- **Test thoroughly**: Verify both standalone and embedded modes work
- **Sync regularly**: Pull upstream updates to get latest OpenReel features

## Known Issues

### Firefox Hard Refresh
Firefox's aggressive cache invalidation on hard refresh (Ctrl+Shift+R) can cause module loading failures in iframe context. Use soft refresh (Ctrl+R) instead. This is a browser-specific behavior and doesn't affect normal workflow usage.

## License

MIT - Same as upstream OpenReel
