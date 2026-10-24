# Minecraft Texture Studio — 0.11.0

A work-in-progress pixel-art editor for Minecraft-style elytra textures, with a 2D pixel canvas, layers, selection, shape tools, UV guides and a live 3D preview. The interface uses a Windows 95/98 / early Windows XP visual style, with bevelled controls, blue title strips and custom context menus.

## Features in 0.11.0

- 64×32 transparent RGBA texture canvas with brush, eraser, flood fill, eyedropper, zoom and a precise pointer dot plus target-pixel preview.
- **Multiple projects in tabs**: each tab keeps its own layers, history, selection, zoom and model skin; the clipboard is shared. New (`Ctrl+N`), open, save (`Ctrl+S`), save as (`Ctrl+Shift+S`) and close (`Ctrl+W`) work per tab, and `Ctrl+Tab` cycles them.
- **Real desktop files**: the `.mts` project is written through a native save dialog and contains the full session (layers, selection, editor settings, skin, palettes and shortcuts). Open uses a native file dialog and saves directly back to the chosen path.
- **Working PNG export** through a native “save as” dialog (browser fallback uses the File System Access API or a download).
- New projects start with the bundled `elytra.png` texture and the default `steve.png` skin; clearing the current texture is undoable and never opens a browser dialog.
- A whole brush or eraser drag undoes in one step, in 2D and in 3D painting.
- Rectangular selection that clips every drawing operation, plus copy/cut/paste, copy merged, paste into a new layer, clear selection, select all and deselect.
- Selection transform: drag inside the selection to move its pixels, drag the eight handles to stretch them, and use the header buttons for 90°/180° rotation and horizontal/vertical flips. Every transform is one undo step and Escape cancels it.
- Line, rectangle and ellipse tools preview the exact pixels in the drawing color before committing.
- Layer stack with visibility, reorder, rename, duplicate, merge down, delete and per-layer opacity. The canvas, 3D preview and PNG export all show the flattened composite.
- PNG import either replaces the active layer or becomes a new layer. The toolbar action is gone; the File/Image menus offer both "Открыть текстуру" and "Импортировать как новый слой".
- Aseprite-inspired palette dock: swatches, HSV wheel, brightness slider, FG/BG colors, inline palette rename, new/duplicate/delete/import/export and color add/remove. There is no separate palette dialog.
- Floating color editor window (open from the HEX swatch or the sliders button): H/S/V sliders, R/G/B sliders, alpha slider, HEX/HEXA input, A/B comparison and a draggable Win9x title bar. Semi-transparent colors paint and export correctly.
- Palette import from `.gpl`, `.hex`, `.txt` and `.json`; `.gpl` export; custom palettes and colors persist in local storage.
- Live `skinview3d` preview with direct 3D painting via UV raycasting, a thin semi-transparent pixel grid and geometry boundaries.
- Holding `Shift` previews a crouched player with the wider in-game elytra crouch angles instead of the 90-degree flying pose.
- Dark grey/light-grey transparency checker in the 2D view, so light pixels stay readable.
- Windows XP icon set used for the brand, File/Edit/Layer menus, undo/redo and confirmation dialogs; the desktop/installer icon is generated from the XP Paint icon.
- Windows 95/98 and early XP visual language: grey panels, bevelled buttons, blue title bars, compact toolbars and a shared keyboard-navigable context menu system.
- Context menus on the 2D canvas, 3D preview, palette and swatches, layers, tools, plus menus for File, Edit, View, Image, Layer, Tools, Settings and Help.
- Separate player-skin import, texture PNG import/export, undo/redo, an unsaved-changes indicator and configurable keyboard shortcuts with conflict detection.
- Keyboard shortcuts are layout-independent: with a Russian layout `Ctrl+ы` fires save, `B` stays on the physical B key, and shortcut recording stores Latin labels. Rectangle is `U`, the UV overlay is `Ctrl+U`.
- `.mts` project format version 2 stores layers, active layer, **selection**, editor settings (including zoom and skin), shortcuts and palettes. Version 1 projects are migrated on open.
- Tauri 2 wrapper with app icons and a default capability manifest for desktop packaging.

## Run in a browser first

Install Node.js 20.19+ or 22.12+ and open a terminal in this folder:

```powershell
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`. On Windows, `RUN-DEV.bat` can install packages and start the dev server.

## Checks

```powershell
npm run typecheck   # tsc -b, strict
npm test            # Vitest: utils, project parsing and an App render smoke test
npm run build       # typecheck + production bundle in dist/
```

If a sandbox or antivirus blocks esbuild's temporary files, point `TEMP`/`TMP` at a writable folder (for example `.\tmp`; `.tmp/` is git-ignored) before running the build.

## Run as a Windows desktop app

Install Rust and Microsoft C++ Build Tools using the official Tauri prerequisites guide: https://v2.tauri.app/start/prerequisites/

Then run the native development window:

```powershell
npm install
npm run tauri dev
```

To build a Windows NSIS installer (`.exe`), run:

```powershell
npm run build
npm run tauri build -- --bundles nsis
```

The installer is created under `src-tauri\target\release\bundle\nsis\`. Icons live in `src-tauri/icons/`, and the window permissions are declared in `src-tauri/capabilities/default.json`.

A verified local build (Rust 1.99.1, VS Build Tools 2022, Tauri 2.12.5) produced:

```
src-tauri\target\release\bundle\nsis\Minecraft Texture Studio_0.11.0_x64-setup.exe
```

The installer is **not code-signed**, so Windows SmartScreen shows a warning: choose «Подробнее» → «Выполнить в любом случае». The raw portable binary is `src-tauri\target\release\minecraft-texture-studio.exe`. The UI is also verified with headless Chromium (tabs, palette, 2D canvas and WebGL preview).

### Build the .exe on GitHub (no local Rust/MSVC needed)

The repository ships `.github/workflows/build-windows.yml`. It runs the checks, builds the NSIS installer on a `windows-latest` runner and uploads it as an artifact. Pushing a `v*` tag also attaches the `.exe` to a draft GitHub release:

```powershell
git tag v0.10.0
git push origin v0.10.0
```

See [docs/RELEASING.md](docs/RELEASING.md) for the full publishing and release checklist.

## Basic controls

| Action | Key |
|---|---|
| Select (marquee) | `M` |
| Brush / eraser / fill / eyedropper | `B` / `E` / `G` / `I` |
| Line / rectangle / ellipse | `L` / `U` / `O` |
| Copy / cut / paste | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` |
| Copy merged / paste into new layer | `Ctrl+Shift+C` / `Ctrl+Shift+V` |
| Clear selection / select all / deselect | `Delete` / `Ctrl+A` / `Ctrl+D` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Y` |
| Import PNG / open project / save project / save as / export PNG | `Ctrl+O` / `Ctrl+Shift+O` / `Ctrl+S` / `Ctrl+Shift+S` / `Ctrl+Shift+E` |
| New project / close project / cycle tabs | `Ctrl+N` / `Ctrl+W` / `Ctrl+Tab` |
| Swap FG/BG | `X` |
| Previous / next palette color | `[` / `]` |
| UV guide / 2D grid / cycle view | `Ctrl+U` / `H` / `V` |
| Crouch preview | hold `Shift` |
| Zoom at pointer | mouse wheel over the canvas |

- All bindings except `[`, `]` and `Shift` are remappable in Settings → Hotkeys; conflicts are rejected.
- The clipboard is internal to the editor (per document session), not the system clipboard.
- With the selection tool, drag inside a marquee to move its pixels, drag a corner/edge handle to stretch them, and use the canvas-header buttons for 90°/180° rotation and flips. Escape cancels a transform in progress; the whole transform is one undo step.
- The floating color window is opened from the HEX swatch or the sliders button in the palette dock. It offers HSV, RGB and alpha sliders, 8-digit HEX, and an A/B comparison where A restores the color from when the window was opened.
- 3D: left-drag paints with FG, right-drag paints with BG; a stationary right-click opens the model menu. Selection and shape tools work on the 2D atlas only, so the model stays orbitable.
- The layer panel is under the palette; double-click a layer name to rename it, right-click for the full layer menu.
- The top bar contains only the document name; saving, importing, exporting and skin loading live in the File menu (`Ctrl+S` for save).

## Technical stack

- React + TypeScript + Vite
- `skinview3d` + Three.js for the player model and 3D preview
- Tauri 2 for the native desktop wrapper
- `lucide-react` for toolbar and menu icons
- Vitest for unit and render smoke tests

## Verification

`npm run build` and the Vitest suite pass on a machine with dependencies installed. The 118 checks cover the flood fill (including selection bounds), layer compositing/merging/reordering, shape rasterization, color conversion, project-layer validation, project save/load with version 1 migration, multi-project tabs (per-tab pixels/history, in-app dirty-close confirmation, open-as-tab), the bundled default texture, unique shortcut bindings, the old U/UV migration and layout-independent key mapping, `.mts`/PNG file naming, 3D UV-grid geometry generation, transform math (rotate/flip/scale/blit), the color editor (HSV/RGB/alpha/A-B, 8-digit HEX, alpha-zero round trip), selection move/resize/rotate/flip with single-step undo and Escape cancellation, jsdom interaction tests for the layer panel, selection tool, pointer cursor, stroke-level undo and clipboard layer operations, and a server-rendered mount of the whole editor shell. The Windows installer is built by `.github/workflows/build-windows.yml` (or locally with Rust + MSVC Build Tools).

Known limitations:

- The canvas is fixed to the 64×32 cape/elytra atlas; document size is not configurable yet.
- Selection is rectangular only. Transform rotation is limited to 90° steps (plus flips), which keeps pixel art lossless; there is no free-angle rotation or floating-selection resize dialog.
- Layers have no blend modes or masks; opacity is the only per-layer compositing control.
- The clipboard is per-session and does not touch the OS clipboard.
- `app.security.csp` is intentionally `null`; a strict CSP should be added together with a tested desktop build.
- Wide screens are the target; the workspace has a 950 px minimum width.

## Next increments

1. Non-rectangular selection and a floating move/transform for selections.
2. Layer blend modes, masks and drag-to-reorder.
3. Configurable document sizes and more accurate UV guides for model variants.
4. More 3D pose presets and automated interaction tests.

