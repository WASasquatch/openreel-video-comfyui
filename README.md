# OpenReel Video - ComfyUI Edition

> **OpenReel Video editor fork with ComfyUI integration. Professional video editing embedded in ComfyUI workflows.**

This is a modified fork of [OpenReel Video](https://github.com/augani/openreel) optimized for seamless integration with **[ComfyUI_Viewer_OpenReel_Extension](https://github.com/YOUR_USERNAME/ComfyUI_Viewer_OpenReel_Extension)**. It enables professional video editing directly within ComfyUI workflows, allowing you to edit AI-generated videos or external media files without leaving your ComfyUI environment.

**[Upstream OpenReel](https://github.com/augani/openreel)** | **[ComfyUI Extension](https://github.com/YOUR_USERNAME/ComfyUI_Viewer_OpenReel_Extension)** | **[Modifications](COMFYUI_CHANGES.md)**

![License](https://img.shields.io/badge/License-MIT-green) ![ComfyUI](https://img.shields.io/badge/ComfyUI-Integration-blue) ![Status](https://img.shields.io/badge/Status-Active-brightgreen)

---

## Purpose

This fork contains **source code modifications** specifically for ComfyUI integration:

- **Vite base path** configured for ComfyUI's `/was/openreel_video/app/` routing
- **Static imports** to prevent iframe reload loops in ComfyUI context
- **PostMessage API** for video content injection from ComfyUI workflows
- **Blend modes & opacity** optimized for multi-clip rendering during playback
- **Embedded mode** with theme synchronization to match ComfyUI's UI
- **Error handling** adapted for iframe embedding

See **[COMFYUI_CHANGES.md](COMFYUI_CHANGES.md)** for detailed technical modifications.

---

## Why This Fork?

OpenReel Video is a powerful browser-based video editor, but integrating it into ComfyUI required specific modifications:

- **Routing compatibility** - Assets must resolve under ComfyUI's custom routes
- **Iframe stability** - Prevent reload loops that break the editing session
- **Dynamic content loading** - Videos sent via postMessage instead of URL params
- **Performance optimizations** - Blend modes work during playback, not just preview
- **Theme integration** - Match ComfyUI's dark/light mode automatically

---

## Features

### Video Editing
- **Multi-track timeline** - Unlimited video, audio, image, text, and graphics tracks
- **Real-time preview** - Smooth playback with GPU acceleration
- **Precision editing** - Frame-accurate scrubbing, cut, trim, split, ripple delete
- **Transitions** - Crossfade, dip to black/white, wipe, slide effects
- **Video effects** - Brightness, contrast, saturation, blur, sharpen, glow, vignette, chroma key
- **Blend modes** - Multiply, screen, overlay, add, subtract, and more
- **Speed control** - 0.25x to 4x with audio pitch preservation
- **Crop & transform** - Position, scale, rotation with 3D perspective

### Graphics & Text
- **Professional text editor** - Rich styling, shadows, outlines, gradients
- **20+ text animations** - Typewriter, fade, slide, bounce, pop, elastic, glitch
- **Karaoke-style subtitles** - Word-by-word highlighting synced to audio
- **Shape tools** - Rectangle, circle, arrow, polygon, star with fill/stroke
- **SVG support** - Import SVGs with color tinting and animations
- **Stickers & emoji** - Built-in library
- **Background generator** - Solid colors, gradients, mesh gradients, patterns
- **Keyframe animations** - Animate any property over time with 20+ easing curves

### Audio
- **Multi-track mixing** - Unlimited audio tracks with real-time mixing
- **Waveform visualization** - Visual audio editing
- **Audio effects** - EQ, compressor, reverb, delay, chorus, flanger, distortion
- **Volume & panning** - Per-clip controls with fade in/out
- **Beat detection** - Auto-generate markers synced to music
- **Audio ducking** - Auto-reduce music when dialog plays
- **Noise reduction** - 3-pass noise removal (tonal, broadband, rumble)

### Color Grading
- **Color wheels** - Lift, gamma, gain controls
- **HSL adjustments** - Hue, saturation, lightness fine-tuning
- **Curves editor** - RGB and individual channel curves
- **LUT support** - Import and apply 3D LUTs
- **Built-in presets** - One-click color grading

### Export
- **MP4 (H.264/H.265)** - Universal compatibility
- **WebM (VP8/VP9/AV1)** - Web-optimized format
- **ProRes** - Professional intermediate format (Proxy, LT, Standard, HQ, 4444)
- **Quality presets** - 4K @ 60fps, 1080p, 720p, 480p
- **Custom settings** - Bitrate, frame rate, codec options, color depth
- **Hardware encoding** - WebCodecs for fast exports
- **AI upscaling** - Enhance resolution with WebGPU shaders
- **Audio export** - MP3, WAV, AAC, FLAC, OGG
- **Image sequences** - JPG, PNG, WebP frame export
- **Progress tracking** - Real-time progress with cancel support

### Professional Tools
- **Unlimited undo/redo** - Full history with recovery
- **Auto-save** - Never lose work (IndexedDB storage)
- **Keyboard shortcuts** - Professional workflow
- **Snap to grid** - Magnetic alignment
- **Track management** - Show/hide, lock/unlock, reorder
- **Subtitle support** - SRT import with customizable styling
- **Screen recording** - Record screen, camera, or both
- **Project sharing** - Export/import project files

### Performance
- **WebGPU rendering** - GPU-accelerated compositing
- **WebCodecs API** - Hardware video decoding/encoding
- **Frame caching** - LRU cache for smooth playback
- **Web Workers** - Background processing
- **4K support** - Edit and export in 4K resolution

---

## Building for ComfyUI

This repository contains **source code only** (no built artifacts). Build it to generate the app for ComfyUI_Viewer_OpenReel_Extension.

### Prerequisites

- Node.js 18+
- pnpm 9.0.0+

### Build Instructions

```bash
# Clone this repository
git clone https://github.com/YOUR_USERNAME/openreel-video-comfyui.git
cd openreel-video-comfyui

# Install dependencies
pnpm install

# Build the app (output: apps/web/dist/)
pnpm build
```

### Deploy to ComfyUI Extension

```bash
# Remove old build artifacts
rm -rf ../ComfyUI_Viewer_OpenReel_Extension/apps/openreel_app/assets

# Copy new build
cp -r apps/web/dist/* ../ComfyUI_Viewer_OpenReel_Extension/apps/openreel_app/

# Restart ComfyUI to load the new build
```

### Development Mode

For local testing outside ComfyUI:

```bash
pnpm dev
# Opens on http://localhost:5173
# Test with: ?embedded=true&theme_bg=%231a1a2e&theme_fg=%23e0e0e0
```

**Note:** Development mode uses root path `/`. Production build uses `/was/openreel_video/app/` for ComfyUI routing.

---

## Browser Requirements

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 94+ | Full support |
| Edge | 94+ | Full support |
| Firefox | 130+ | Full support |
| Safari | 16.4+ | Full support |

All major browsers now support WebCodecs for hardware-accelerated video encoding/decoding.

**Recommended:**
- 8GB+ RAM
- Dedicated GPU for 4K editing
- Modern multi-core CPU

---

## Architecture

### Monorepo Structure

```
openreel-video-comfyui/
├── apps/web/              # React frontend with ComfyUI modifications
│   ├── src/
│   │   ├── components/
│   │   │   └── editor/    # Timeline, Preview, Inspector
│   │   ├── hooks/
│   │   │   └── useComfyUIEmbedding.ts  # PostMessage handler
│   │   ├── stores/        # Zustand state management
│   │   └── lib/
│   │       └── error-handler.ts  # Embedded mode error handling
│   └── vite.config.ts     # ComfyUI base path: /was/openreel_video/app/
│
└── packages/core/         # Core video/audio engines
    └── src/
        ├── video/         # Video processing, blend modes, WebGPU
        ├── audio/         # Web Audio API, effects
        ├── graphics/      # Canvas/THREE.js, shapes, SVG
        ├── text/          # Text rendering, animations
        └── export/        # MP4/WebM encoding
```

### ComfyUI Integration Points

**1. Vite Configuration** (`apps/web/vite.config.ts`)
- Base path set to `/was/openreel_video/app/` for proper asset resolution
- All JS chunks, CSS, and workers use this base path

**2. Iframe Communication** (`apps/web/src/hooks/useComfyUIEmbedding.ts`)
- Listens for `comfyui-import-video` postMessage events
- Receives video URL, audio URL, fps, sessionId from ComfyUI workflows
- Deduplicates imports to prevent reload loops

**3. Static Imports** (`apps/web/src/App.tsx`)
- EditorInterface uses static import instead of React.lazy()
- Prevents module loading failures on hard refresh in iframe context

**4. Error Handling** (`apps/web/src/lib/error-handler.ts`)
- Skips `window.location.reload()` when `embedded=true`
- Prevents reload loops that break editing sessions

**5. Blend Modes** (`apps/web/src/components/editor/preview/canvas-renderers.ts`)
- `drawFrameWithTransform` accepts `blendMode` parameter
- Applies `ctx.globalCompositeOperation` for proper layer compositing
- Works during both paused preview and playback

**6. Multi-Clip Rendering** (`apps/web/src/components/editor/Preview.tsx`)
- Uses `findAllClipsAtTime` instead of `findClipAtTime`
- Renders all overlapping clips with correct blend modes and opacity
- Respects track ordering (lower track index = rendered last = on top)

### Key Technologies

- **React 18** + **TypeScript** - Type-safe UI
- **Zustand** - State management
- **MediaBunny** - Video/audio processing
- **WebCodecs** - Hardware encoding/decoding
- **WebGPU** - GPU-accelerated rendering
- **Web Audio API** - Audio processing
- **THREE.js** - 3D transforms
- **Vite** - Build tool with custom base path

---

## Contributing

Contributions are welcome! This fork focuses on **ComfyUI integration improvements**.

**Ways to contribute:**
- Report ComfyUI-specific bugs with reproduction steps
- Improve iframe embedding stability
- Optimize performance for ComfyUI workflows
- Enhance theme synchronization
- Fix routing or asset loading issues
- Improve documentation

**Development workflow:**
```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/openreel-video-comfyui.git
cd openreel-video-comfyui

# Create feature branch
git checkout -b feat/comfyui-improvement

# Make changes, then test
pnpm typecheck
pnpm lint

# Test in ComfyUI
pnpm build
cp -r apps/web/dist/* ../ComfyUI_Viewer_OpenReel_Extension/apps/openreel_app/

# Commit and push
git commit -m "feat: improve ComfyUI integration"
git push origin feat/comfyui-improvement
```

### Syncing with Upstream OpenReel

To pull updates from the original OpenReel:

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

# Test and push
pnpm build
git push origin main
```

---

## ComfyUI Integration Status

### ✅ Completed
- **Vite base path** - Assets resolve under `/was/openreel_video/app/`
- **Static imports** - No lazy loading to prevent iframe reload loops
- **PostMessage API** - Video content injection from ComfyUI workflows
- **Blend modes & opacity** - Work during playback, not just preview
- **Multi-clip rendering** - All overlapping clips render with correct ordering
- **Theme synchronization** - Matches ComfyUI's dark/light mode
- **Error handling** - No reload loops in embedded mode
- **Stable iframe loading** - Loads once, never reloads

### 🔄 In Progress
- Performance optimizations for large ComfyUI workflows
- Better error messages for ComfyUI-specific issues
- Documentation improvements

### 📋 Planned
- Automated build releases via GitHub Actions
- Integration tests for ComfyUI embedding
- Performance profiling for workflow optimization
- Enhanced theme customization options

---

## License

MIT License - Same as upstream OpenReel. Use freely for personal and commercial projects.

See [LICENSE](LICENSE) for details.

---

## Acknowledgments

**Forked from:**
- [OpenReel Video](https://github.com/augani/openreel) by [@python_xi](https://x.com/python_xi) - The original browser-based video editor

**Built for:**
- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) - Powerful node-based UI for Stable Diffusion
- [ComfyUI_Viewer](https://github.com/YOUR_USERNAME/ComfyUI_Viewer) - Content viewer framework for ComfyUI

**Technologies:**
- [MediaBunny](https://mediabunny.dev) - Media processing
- [React](https://react.dev) - UI framework
- [Zustand](https://zustand-demo.pmnd.rs/) - State management
- [THREE.js](https://threejs.org) - 3D rendering
- [Vite](https://vitejs.dev) - Build tool

---

## Support

**For ComfyUI integration issues:**
- Open an issue in this repository
- Include ComfyUI version, browser, and reproduction steps

**For general OpenReel features:**
- See upstream [OpenReel repository](https://github.com/augani/openreel)
- Check [OpenReel Discussions](https://github.com/augani/openreel/discussions)

---

## Related Projects

- **[OpenReel Video](https://github.com/augani/openreel)** - Original browser-based video editor
- **[ComfyUI_Viewer_OpenReel_Extension](https://github.com/YOUR_USERNAME/ComfyUI_Viewer_OpenReel_Extension)** - ComfyUI extension that uses this fork
- **[ComfyUI](https://github.com/comfyanonymous/ComfyUI)** - Node-based UI for Stable Diffusion

---

*Professional video editing integrated into ComfyUI workflows. Built on OpenReel's solid foundation.*
