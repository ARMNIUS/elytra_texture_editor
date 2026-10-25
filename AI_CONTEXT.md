# AI coding brief — RawSprite 0.13.0

Project: React + TypeScript + Vite app with a Tauri 2 wrapper. Continue in the existing repository; never regenerate the app from scratch.

## Product goal
A pixel-art editor for Minecraft skin, cape and elytra textures: Aseprite-like 2D tools and palette management, UV atlas guides, and an editable 3D model preview.

## Current state (0.13.0 split)
- `apps/rawsprite`: 2D-only React/Vite/Tauri app (`@rawsprite/app`, port 5174, identifier `com.rawsprite.editor`, `.rsp`). It renders `<App mode="rawsprite" />` with no preview component, so three.js/skinview3d are not imported.
- `apps/rawsprite-minecraft`: Minecraft React/Vite/Tauri app (`@rawsprite/app-minecraft`, port 5175, identifier `com.rawsprite.minecraft`, `.mts`). It renders `<App mode="minecraft" previewComponent={ElytraViewer} />`.
- `packages/editor-app/src/App.tsx`: shared editor shell with `mode` and `previewComponent` injection. The old root `src/App.tsx` is a re-export used by the legacy test harness.
- `src/App.tsx`: documents carry `width`/`height`; project format version 3 stores them and versions 1/2 migrate as 64×32. Undo history is capped by canvas area. The 3D preview is skipped for non-64×32 documents. New blank documents are created through `NewDocumentDialog`.
- `src/App.tsx` (continued): workspace with multiple documents (`DocumentState[]` + active id). Each document owns layers, active layer, undo/redo, selection, zoom, model skin, dirty flag and `projectPath`; the clipboard is global. **There is one paint color** (`currentColor`); FG/BG and the `X` swap action were deliberately removed. Tab bar creates/switches/closes projects (`Ctrl+N`/`Ctrl+W`/`Ctrl+Tab`), opening a project adds a tab unless the only tab is pristine, dirty tabs use the in-app `ConfirmDialog`, and `beforeunload` warns about unsaved projects. Initial documents and the tab “+” use `src/data/defaultElytra.ts` (generated from `src/assets/elytra.png`) and the default Steve skin. The **Файл → Новый спрайт…** action opens `NewDocumentDialog` and creates a transparent 1–2048 px document with a fitted zoom. Saving (`Ctrl+S`) writes the current `.mts` path or asks for one; `Ctrl+Shift+S` always asks (Save As); native open uses the dialog plugin, while browser mode falls back to a file input. All pixel edits write to the active layer; children receive `displayPixels` (composite + floating transform preview). A brush/eraser stroke is one undo step; selection move/resize commits one step; rotation/flip bakes immediately.
- `src/utils/files.ts`: native save/open dialogs (`@tauri-apps/plugin-dialog`), Rust file-write/read invokes, browser File System Access fallback, `basename`, extension and `.mts`/PNG name helpers.
- `packages/core/src/shortcutKey.ts`: layout-independent key mapping (Russian ЙЦУКЕН → Latin physical keys, with logical Latin keys preserved for other layouts); used by both the global shortcut matcher and shortcut recording.
- `packages/core/src/layers.ts`: layer model, ID generation, flattening (`compositeLayers`), merge, reorder and naming helpers.
- `packages/core/src/transform.ts`: pixel-block extraction, nearest-neighbour scaling, 90°/180° rotation, flips, source-over blitting and clamped selection bounds.
- `packages/core/src/shapes.ts`: Bresenham lines, rectangle/ellipse outlines, selection normalization/clamping and hit tests. The ellipse is a TypeScript port of Aseprite's Alois Zingl algorithm (flat tops, stepped sides).
- `packages/core/src/texture.ts`: raster helpers — selection-clipped `paintPoints`, bounded `floodFill`, region `copyRegion`/`pasteRegion`/`clearRegion`, PNG export/import.
- `packages/core/src/project.ts`: `.mts` layer validation; version 3 stores width/height, versions 1/2 migrate as 64×32.
- `src/utils/uvGrid.ts`: UV-boundary line geometry for the 3D pixel grid (double-sided, depth-tested).
- `packages/core/src/color.ts`: hex/RGB/HSV conversions, RGBA parsing/formatting (`formatRgbaExact` preserves RGB at alpha 0), `normalizeRgbaColor` (8-digit HEX), `opaqueColor`, `withAlpha` and source-over compositing.
- `src/components/ColorEditorWindow.tsx`: draggable floating Win9x window with HSV + RGB + alpha sliders, numeric fields, HEX/HEXA input, A/B swatches (A restores the color from opening time) and click-to-restore.
- `src/components/TextureCanvas.tsx`: 64×32 canvas with brush/eraser/fill/eyedropper/select/line/rect/ellipse tools, a pointer dot plus target-cell preview for every tool, animated two-tone selection marquee with 8 transform handles, pixel-exact shape preview, native non-passive wheel zoom, UV guides and context menu. Right-press menu opening is deferred to pointerup for painting tools because Chromium dispatches `contextmenu` on press.
- `src/components/LayersPanel.tsx`: layer list (top-first), visibility, inline rename, add/duplicate/merge/reorder/delete, opacity slider and per-layer context menu.
- `src/components/ElytraViewer.tsx`: `skinview3d` preview and raycast UV painting; the 3D pixel grid is generated as line geometry on both sides of the wing surface and is assigned to `gridLinesRef` (the 0.6.x bug was a missing assignment). The default player skin is `src/assets/steve.png`; imported skins override it. Crouch pose uses the library's fully crouched wing angles (z=0.72, y=0.30, x=0.2618) and lowers the elytra rig by 1.6 units so the wings sit behind the head. Right-drag paints with the single current color. 3D strokes also report `onStrokeStart`/`onStrokeEnd` so they undo as one step. Shape/selection tools leave camera orbiting untouched.
- `packages/plugin-minecraft/src`: Minecraft plugin runtime — `ElytraViewer`, `MinecraftPreview` (model import bar), `ModelPreview` (generic Three.js viewport), `modelGrid` (fragment-shader UV pixel grid), `modelLoader` (`.bbmodel`/Bedrock via `three-blockbench` and `@bedrock-viewer/model-viewer`), `uvGrid`, generated default elytra pixels and Steve/elytra assets. Three upgraded to 0.186.1. The old `src/components/ElytraViewer.tsx`, `src/utils/uvGrid.ts` and `src/data/defaultElytra.ts` paths re-export it.
- `packages/editor-ui/src`: shared UI — Win9x primitives (`ContextMenu`, `ConfirmDialog`, `XpIcon`, `NewDocumentDialog`), XP icons, `TextureCanvas`, `PalettePanel`, `LayersPanel`, `ColorEditorWindow`, `ShortcutsModal`, `ToolId` and the native/browser file-dialog service. `src/components/*` and `src/utils/files.ts` are compatibility re-exports; only the Minecraft-specific `ElytraViewer` stays in the app.
- `packages/core/src`: framework-agnostic raster core (`color`, `layers`, `texture`, `transform`, `project`, `shapes`, `palettes`, `shortcutKey`). The old `src/utils/*` modules are thin re-exports so the app can migrate gradually. Functions accept explicit canvas dimensions where needed; `TEXTURE_WIDTH/HEIGHT` remain only as 64×32 defaults for legacy projects.
- `src/components/PalettePanel.tsx`: the only palette surface — swatches, HSV wheel, value slider, HEX/HEXA, a single current color, color add/delete, palette management in a compact “…” menu, and the **palette lock** button/`A` shortcut (closed by default). Locked mode still changes the paint color but never the selected swatch; add/remove/rename/delete are blocked except explicit “+”/“В палитру” additions, which stay available. Swatches are selected by index, so duplicate colors remain individually editable. HSV draft state preserves hue/saturation at value 0. Palette deletion uses `ConfirmDialog`; there are no `window.confirm` calls left in `src`. `.gpl` export uses the native save dialog / File System Access fallback.
- `src/components/ConfirmDialog.tsx`: portal-based Win9x message box with XP alert icon and Escape/Enter handling, used for dirty-tab close and palette deletion. `src/components/XpIcon.tsx` maps the resized Windows XP icons in `src/assets/xp/` for the brand, menus, undo/redo and dialogs.
- `src/data/defaultElytra.ts`: generated 64×32 pixel array from `src/assets/elytra.png`; do not hand-edit it without regenerating from the PNG.
- `src/components/ContextMenu.tsx`: single menu provider with viewport clamping, focus restore, Escape/resize/scroll handling and arrow-key navigation.
- `src/components/ShortcutsModal.tsx`: remappable bindings with duplicate/reserved-key detection; `[`, `]`, `A`, `Shift` are reserved. `normalizeShortcuts` migrates the old `U` collision (rectangle wins, UV overlay moves to `Ctrl+U`). Includes copy-merged, paste-into-new-layer, new/close project, save-as and tab cycling. Shortcut recording uses `shortcutKey` so Russian layouts store Latin keys.
- `src/styles.css`: single design stylesheet in the Win9x/early XP language, including the document tab bar, XP icon sizing, in-app dialog, the darker `#8f8f8f`/`#b8b8b8` transparency checker and a grid-centred 2D canvas stage.
- `src/components/NewDocumentDialog.tsx`: Win9x dialog for **Файл → Новый спрайт…**, with 1–2048 px width/height, presets, transparent background and Enter/Escape handling.
- `src/**/*.test.{ts,tsx}`: 144 Vitest checks, including server-rendered App smoke tests, jsdom interaction tests for layer management, selection/transform, color editing, pointer cursor, stroke-level undo, clipboard layer operations, multi-project tabs, default texture, in-app confirmations, shortcut uniqueness/migration, layout-independent keys, `.mts`/PNG file naming, palette lock/read-only behavior, adding colors while locked, duplicate-swatch selection/editing, value-zero HSV retention, palette export, Aseprite ellipse geometry, project save/load/migration, arbitrary canvas creation/load/save and custom-canvas painting coverage.
- `src-tauri/src/lib.rs`: initializes `tauri-plugin-dialog` and exposes `write_text_file`, `write_binary_file` and `read_text_file` commands. Capability `dialog:default` is required for native open/save.
- `.github/workflows/build-windows.yml` + `docs/RELEASING.md`: Windows NSIS installer build on GitHub Actions and the publishing/release checklist.
- `src-tauri/`: Tauri 2 shell with icons (regenerated from the XP Paint icon), explicit `main` window label and `capabilities/default.json`.

## Requirements
1. Preserve and improve the current retro design system; use reusable CSS classes/tokens rather than one-off visual patches.
2. Provide context menus for meaningful surfaces/actions and keep rare actions out of toolbar clutter. Don't intercept native right-click editing inside input/select/textarea fields.
3. Keep TypeScript strict and avoid `any`.
4. Keep browser mode (`npm run dev`) and desktop mode (`npm run tauri dev`) working. Run `npm run typecheck`, `npm test` and `npm run build` when dependencies are installed.
5. Preserve PNG alpha; don't bake visual grid/UV guides or selection outlines into exported texture.
6. Elytra UV picks must come from `Raycaster` intersection UVs, not approximate screen coordinates.
7. Don't add cloud sync, telemetry, accounts or remote services. User-requested local default textures live in `src/assets/`; keep them local and don't fetch assets at runtime.
8. Keep palette and skin data local.
9. `.mts` format version 2 must keep loading version 1 documents; do not raise the version without a migration path.
10. Desktop file operations must use native dialogs and the Rust commands in `src-tauri/src/lib.rs`; never rely on anchor downloads in Tauri. Browser fallbacks stay behind `isDesktopRuntime()`.

## Verification note
`npm run typecheck`, `npm test` (144 checks) and `npm run build` pass in this workspace, and the Vite dev server serves all modules. Two Windows NSIS installers are built with Rust + VS Build Tools 2022 + Tauri 2.12.5: `apps/rawsprite/src-tauri/target/release/bundle/nsis/RawSprite_0.1.7_x64-setup.exe` and `apps/rawsprite-minecraft/src-tauri/target/release/bundle/nsis/RawSprite Minecraft_0.14.9_x64-setup.exe` (unsigned). The root `src-tauri` and root Vite shell are legacy compatibility/test harnesses. Native dialogs and file writes compile, but the desktop GUI cannot be launched from the agent shell (sandbox/SmartScreen); smoke-test them manually on the desktop. `src-tauri/Cargo.lock` is committed; keep it updated when dependencies change.

## Next increments
- Non-rectangular selection and floating selection move/transform.
- Layer blend modes, masks and drag-to-reorder.
- Configurable document sizes and more accurate UV reference overlays.
- Automated interaction tests (pointer flows, layer operations).


