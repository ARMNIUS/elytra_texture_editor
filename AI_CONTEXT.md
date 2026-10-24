# AI coding brief — Minecraft Texture Studio 0.9.1

Project: React + TypeScript + Vite app with a Tauri 2 wrapper. Continue in the existing repository; never regenerate the app from scratch.

## Product goal
A pixel-art editor for Minecraft skin, cape and elytra textures: Aseprite-like 2D tools and palette management, UV atlas guides, and an editable 3D model preview.

## Current state (0.9.1)
- `src/App.tsx`: documents the layer stack (`Layer[]`, bottom-to-top), active layer, undo/redo snapshots, selection + floating transform, internal clipboard, hotkeys, view modes and menus. All pixel edits write to the active layer; children receive `displayPixels` (the composite plus a live floating transform preview). A brush/eraser stroke is one undo step (`beginStroke`/`endStroke`); move/resize lifts the selected pixels, previews them and commits one history step; rotation/flip buttons bake the transform immediately. Toolbar/breadcrumb/top-right actions were removed intentionally — saving is `Ctrl+S`/File menu.
- `src/utils/layers.ts`: layer model, ID generation, flattening (`compositeLayers`), merge, reorder and naming helpers.
- `src/utils/transform.ts`: pixel-block extraction, nearest-neighbour scaling, 90°/180° rotation, flips, source-over blitting and clamped selection bounds.
- `src/utils/shapes.ts`: Bresenham lines, rectangle/ellipse outlines, selection normalization/clamping and hit tests.
- `src/utils/texture.ts`: raster helpers — selection-clipped `paintPoints`, bounded `floodFill`, region `copyRegion`/`pasteRegion`/`clearRegion`, PNG export/import.
- `src/utils/project.ts`: version 2 `.mts` layer validation/migration helpers.
- `src/utils/uvGrid.ts`: UV-boundary line geometry for the 3D pixel grid (double-sided, depth-tested).
- `src/utils/color.ts`: hex/RGB/HSV conversions, RGBA parsing/formatting, `normalizeRgbaColor` (8-digit HEX), `opaqueColor`, `withAlpha` and source-over compositing.
- `src/components/ColorEditorWindow.tsx`: draggable floating Win9x window with HSV + RGB + alpha sliders, numeric fields, HEX/HEXA input, A/B swatches (A restores the color from opening time) and click-to-restore.
- `src/components/TextureCanvas.tsx`: 64×32 canvas with brush/eraser/fill/eyedropper/select/line/rect/ellipse tools, a pointer dot plus target-cell preview for every tool, animated two-tone selection marquee with 8 transform handles, pixel-exact shape preview, native non-passive wheel zoom, UV guides and context menu. Right-press menu opening is deferred to pointerup for painting tools because Chromium dispatches `contextmenu` on press.
- `src/components/LayersPanel.tsx`: layer list (top-first), visibility, inline rename, add/duplicate/merge/reorder/delete, opacity slider and per-layer context menu.
- `src/components/ElytraViewer.tsx`: `skinview3d` preview and raycast UV painting; the 3D pixel grid is generated as line geometry on both sides of the wing surface and is assigned to `gridLinesRef` (the 0.6.x bug was a missing assignment). 3D strokes also report `onStrokeStart`/`onStrokeEnd` so they undo as one step. Shape/selection tools leave camera orbiting untouched.
- `src/components/PalettePanel.tsx`: the only palette surface — swatches, HSV wheel, value slider, HEX/HEXA, FG/BG, color add/delete, palette management and the entry point to the color editor window. The old configurator modal was removed deliberately.
- `src/components/ContextMenu.tsx`: single menu provider with viewport clamping, focus restore, Escape/resize/scroll handling and arrow-key navigation.
- `src/components/ShortcutsModal.tsx`: remappable bindings with duplicate/reserved-key detection; `[`, `]`, `Shift` are reserved. Includes copy-merged (`Ctrl+Shift+C`) and paste-into-new-layer (`Ctrl+Shift+V`).
- `src/styles.css`: single design stylesheet in the Win9x/early XP language. Keep it free of selectors no component renders.
- `src/**/*.test.{ts,tsx}`: 98 Vitest checks, including server-rendered App smoke tests, jsdom interaction tests for layer management, selection/transform, color editing, pointer cursor, stroke-level undo, clipboard layer operations and project save/load/migration coverage.
- `.github/workflows/build-windows.yml` + `docs/RELEASING.md`: Windows NSIS installer build on GitHub Actions and the publishing/release checklist. The color picker uses `formatRgbaExact` so alpha 0 keeps RGB.
- `src-tauri/`: Tauri 2 shell with icons, explicit `main` window label and `capabilities/default.json`.

## Requirements
1. Preserve and improve the current retro design system; use reusable CSS classes/tokens rather than one-off visual patches.
2. Provide context menus for meaningful surfaces/actions and keep rare actions out of toolbar clutter. Don't intercept native right-click editing inside input/select/textarea fields.
3. Keep TypeScript strict and avoid `any`.
4. Keep browser mode (`npm run dev`) and desktop mode (`npm run tauri dev`) working. Run `npm run typecheck`, `npm test` and `npm run build` when dependencies are installed.
5. Preserve PNG alpha; don't bake visual grid/UV guides or selection outlines into exported texture.
6. Elytra UV picks must come from `Raycaster` intersection UVs, not approximate screen coordinates.
7. Don't bundle original Minecraft assets or add cloud sync, telemetry, accounts or remote services.
8. Keep palette and skin data local.
9. `.mts` format version 2 must keep loading version 1 documents; do not raise the version without a migration path.

## Verification note
`npm run typecheck`, `npm test` (98 checks) and `npm run build` pass in this workspace, and the Vite dev server serves all modules. The Windows NSIS installer was built successfully with Rust 1.99.1 + VS Build Tools 2022 + Tauri 2.12.5 at `src-tauri/target/release/bundle/nsis/Minecraft Texture Studio_0.9.1_x64-setup.exe` (unsigned). GUI launch cannot be tested from the agent shell (the sandbox cannot create windows); verify it manually on the desktop. `src-tauri/Cargo.lock` is committed; keep it updated when dependencies change.

## Next increments
- Non-rectangular selection and floating selection move/transform.
- Layer blend modes, masks and drag-to-reorder.
- Configurable document sizes and more accurate UV reference overlays.
- Automated interaction tests (pointer flows, layer operations).


