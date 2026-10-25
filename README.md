# RawSprite

Two desktop pixel editors built from one shared raster core:

- **RawSprite** — a general pixel-art / sprite editor for arbitrary canvas sizes.
- **RawSprite Minecraft** — the same editor plus the Minecraft texture plugin: skins, elytra, cape, UV guides and a live 3D preview.

The interface uses a Windows 95/98 / early XP visual language: grey panels, bevelled controls, blue title strips and custom context menus.

## Status — 0.13 split

The application layer is now split into separate bundles:

| App | Bundle | Installer |
|---|---|---|
| RawSprite | ~390 KB JS | `RawSprite 0.1.2 setup.exe` |
| RawSprite Minecraft | ~920 KB JS (three.js + skinview3d) | `RawSprite Minecraft 0.13.2 setup.exe` |

RawSprite does not import `three`, `skinview3d` or `ElytraViewer`. The Minecraft app injects `ElytraViewer` as a preview component.

The old root Vite/Tauri shell remains as a compatibility/test harness while the apps are stabilised.

## Shared features

- Arbitrary transparent RGBA canvas from 1×1 to **2048×2048**; **Файл → Новый проект…**, the tab “+” and `Ctrl+N` all open one size dialog with presets and custom width/height.
- Texture import reads the image at its native pixel size and places it at the top-left; oversized images are clipped and reported, never stretched across the canvas. It can replace the active layer or become a new layer.
- Brush, eraser, flood fill, eyedropper, line, rectangle and ellipse tools with pixel preview.
- Rectangular selection, copy/cut/paste, copy merged, paste into a new layer, clear, select all and deselect.
- Selection move/resize/rotate/flip with a single undo step; Escape cancels.
- Layer stack with visibility, reorder, rename, duplicate, merge down, delete and per-layer opacity.
- Undo/redo; a brush stroke is one step. Undo depth scales down for very large canvases.
- Aseprite-inspired palette dock with a single current color, HSV wheel, brightness slider, HEX/HEXA, palette management, `.gpl` import/export and a palette lock (closed by default, `A` toggles).
- Floating color editor with HSV/RGB/alpha sliders, numeric fields, 8-digit HEX and A/B comparison.
- Native Windows save/open dialogs (Tauri) with browser File System Access fallbacks.
- Projects in tabs, dirty-close confirmation, configurable shortcuts and layout-independent keys (Russian ЙЦУКЕН maps to physical Latin keys).
- Zoom from 5% to 2048×, multiplicative wheel steps and a **Вписать холст** action so large canvases are visible in full.
- Windows XP icon set, custom context menus and a shared keyboard-navigable UI.
- Real `.mts` project files: layers, active layer, selection, settings, shortcuts and palettes. Format version 3 stores width/height; versions 1 and 2 migrate as 64×32.
- RawSprite uses the `.rsp` extension for its projects. The project container is still the same JSON format while the split stabilises.

## Minecraft plugin

`@rawsprite/plugin-minecraft` supplies:

- `ElytraViewer` with a live `skinview3d` player/elytra/cape preview.
- Direct 3D painting via UV raycasting.
- Pixel grid and geometry boundary overlays on the model.
- Shift-preview of the crouched pose with wider elytra angles.
- Default Steve skin and generated default elytra pixels.
- UV grid geometry.

Blockbench `.bbmodel` and Bedrock geometry loaders are the next model milestone; the plugin boundary and loader research are in `docs/SPLIT_ARCHITECTURE.md`.

## Repository layout

```text
apps/
  rawsprite/              # 2D-only React/Vite/Tauri app
  rawsprite-minecraft/    # React/Vite/Tauri app with the Minecraft plugin
packages/
  core/                   # raster, layers, project validation, color, shapes
  editor-ui/              # canvas, palette, layers, dialogs, files, styles
  editor-app/             # shared editor shell with mode/preview injection
  plugin-api/             # plugin contract v1
  plugin-minecraft/       # ElytraViewer, UV grid, assets, default elytra
src/                      # legacy root shell used by the test suite
docs/                     # architecture and release notes
```

## Installers

Built locally (unsigned):

```text
apps/rawsprite/src-tauri/target/release/bundle/nsis/RawSprite_0.1.2_x64-setup.exe
apps/rawsprite-minecraft/src-tauri/target/release/bundle/nsis/RawSprite Minecraft_0.13.2_x64-setup.exe
```

SmartScreen will warn because the installers are unsigned: choose **«Подробнее» → «Выполнить в любом случае»**.

## Development

Install Node.js 20.19+ or 22.12+ and Rust + MSVC Build Tools for Tauri.

```bash
npm install

npm run dev:rawsprite      # http://127.0.0.1:5174
npm run dev:minecraft      # http://127.0.0.1:5175

npm run build:rawsprite
npm run build:minecraft

npm run tauri --workspace=@rawsprite/app -- build --bundles nsis
npm run tauri --workspace=@rawsprite/app-minecraft -- build --bundles nsis
```

`npm run dev`, `npm run build` and `npm test` in the repository root still target the legacy shell.

## Verification

`npm run typecheck`, `npm test` (**136 checks**) and `npm run build` pass. The suite covers flood fill, layer compositing/merging/reordering, shapes including the Aseprite ellipse, color conversion, project validation and migration, multi-project tabs, shortcut migration/layout independence, palette locking and duplicate swatches, value-zero HSV retention, arbitrary canvas creation/load/save/painting, selection transforms, clipboard layers, a Minecraft-free RawSprite smoke render, and a full server-rendered shell.

Native dialogs and Tauri file writes compile; the desktop GUI cannot be launched from the agent shell, so installers should be smoke-tested manually on Windows.
