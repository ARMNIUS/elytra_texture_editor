# Changelog

## 0.14.9 / RawSprite 0.1.7 — Icon set rollback

- Rolled the UI and native app icons back to the previous Lucide/XP icon set. The Windows 98 icon experiment was reverted.
- Kept the startup welcome window and the **Сохранить / Не сохранять / Отмена** confirmation for closing a dirty tab or the whole application.
- Tests: 144.
- Installers: RawSprite 0.1.7, RawSprite Minecraft 0.14.9.

## 0.14.8 / RawSprite 0.1.6 — Welcome window, Windows 98 icons, close prompt

- Added a startup welcome window with the app icon/name and three actions: **Создать проект**, **Открыть проект**, **Импортировать PNG**.
- Replaced all UI icons with the user's **w98_*** Windows 98 icon set (including native window/installer icons). Only w98_-prefixed icons are used.
- Closing the app with unsaved changes now opens the same classic confirmation as closing a dirty tab, with **Сохранить / Не сохранять / Отмена**. Saving closes only after a successful save; tab closing also offers the same three choices.
- Desktop close uses Tauri's close-request handler; the browser preview falls back to the native beforeunload prompt.
- Tests: 144.
- Installers: RawSprite 0.1.6, RawSprite Minecraft 0.14.8.

## 0.14.7 / RawSprite 0.1.5 — Scalable 16×16 checker

- Restored the zoom-scaled transparency checkerboard; one checker cell is now 16×16 (a 32×32 pattern) instead of 8×8, with the same #8f8f8f/#b8b8b8 colors.
- Tests: 143.
- Installers: RawSprite 0.1.5, RawSprite Minecraft 0.14.7.

## 0.14.6 / RawSprite 0.1.4 — Shared editor polish

- **Eyedropper**: picking now reliably writes the sampled color into the current color field and reports it in the status bar; picking a transparent pixel reports that no color changed.
- Removed the legacy current-color square from the bottom-right toolbar.
- Moved **«В палитру»** and **«Из палитры»** above the swatch grid, under the palette heading.
- Added **«Удалить этот цвет»** to the swatch right-click menu; explicit deletion works even while the palette lock protects swatches from accidental recoloring.
- Grid display is **off by default** in both apps.
- The transparency checkerboard is fixed at **16×16** and no longer scales with zoom; the same #8f8f8f/#b8b8b8 colors are kept.
- **Ctrl+drag** on a selection creates a copy while keeping the original.
- Middle-click autoscroll is suppressed on the editor shell.
- Alt no longer activates the native window/menu handling.
- **Ctrl+C / Ctrl+V** copy and paste the selected area (existing shortcuts verified).
- Tests: 143.
- Installers: RawSprite 0.1.4, RawSprite Minecraft 0.14.6.

## 0.14.5 — Unified shader UV grid

- Replaced the per-triangle line geometry for imported models with a single fragment-shader UV grid applied to every model material. It follows the surface at every camera angle, has no seams between faces, and no longer produces doubled lines.
- The grid uses the model's texture resolution and draws over transparent texels too (alpha is raised only on grid lines), so filled/textureless models keep a visible grid.
- `.bbmodel` embedded textures are preserved; models with a missing/external texture fall back to the current canvas. Importing a model resizes the canvas to the model texture dimensions, and the resize is undoable.
- Canvas width/height are stored in undo/redo snapshots.
- Coordinate floor grid cells are exactly one model pixel and remain a context-menu option.
- Tests: 140.
- Installers: RawSprite 0.1.3, RawSprite Minecraft 0.14.5.

## 0.14.4 — Model texture sizing and one-sided UV grid

- `.bbmodel` embedded textures are preserved instead of being replaced by the current canvas, fixing stretched model textures. Models without an embedded texture (and Bedrock models) still use the canvas.
- UV grids use the model's real texture resolution and detect raw pixel UVs, preventing double-scaled/duplicated grid lines.
- The imported-model grid is now one-sided; closed models no longer show two offset copies of the same grid.
- Importing a model now resizes the canvas to the model texture dimensions (`resolution` for BBModel, `texture_width/height` for Bedrock). Existing layers are placed at native resolution and the resize is undoable.
- Canvas dimensions are part of undo/redo snapshots.
- Coordinate floor grid cells are exactly one model pixel.
- Tests: 140.
- Installers: RawSprite 0.1.3, RawSprite Minecraft 0.14.4.

## 0.14.3 — Correct model textures and pixel grid

- `.bbmodel` files with an embedded texture now keep that texture instead of being overwritten by the current canvas. This fixes the stretched/squashed model textures.
- UV grids use the model's own texture resolution (`resolution` for BBModel, `description.texture_width/height` for Bedrock), so grid lines follow the real UV atlas.
- Raw pixel UVs are detected instead of being multiplied by texture size a second time; the surface grid no longer doubles or explodes on raw-UV models.
- The optional coordinate floor grid is now generated from the model bounds with **one cell per model pixel** (using the model's unit scale), so its width/length match the model.
- Tests: 139.
- Installers: RawSprite 0.1.3, RawSprite Minecraft 0.14.3.

## 0.14.2 — UV pixel grid on imported models

- Fixed the 3D grid: imported `.bbmodel`/Bedrock models now get a **pixel UV grid on the model surface**, generated from each mesh's real UV atlas with `makeUvGridGeometry`, instead of a coordinate floor grid.
- The coordinate floor grid is still available as **«Показать координатную сетку»** in the 3D preview context menu; it is off by default.
- Grid/bounds toggles now work for imported models, including after switching models; their Three.js helpers are disposed correctly.
- RawSprite 0.1.3 remains current; RawSprite Minecraft is 0.14.2.
- Tests: 139.

## 0.14.1 — Cleaner chrome and model overlays

- Removed the duplicate project-name field from the header in both apps; the active tab is now the single visible project name.
- Disabled text selection across the editor chrome (`user-select: none`); inputs, textareas and contenteditable fields remain selectable. This also prevents a selected status bar from blocking OrbitControls rotation.
- **Сетка** and **Границы** now work for imported `.bbmodel` and Bedrock models: a GridHelper is drawn at the model base and a Box3Helper around the model bounds. The helpers update when the model changes and are disposed with the preview.
- The Minecraft app uses the RawSprite Minecraft title/brand consistently.
- Tests: 139.
- Installers: RawSprite 0.1.3, RawSprite Minecraft 0.14.1.

## 0.14.0 — Model imports (Blockbench + Bedrock)

- Upgraded Three.js to 0.186.1 and added the existing MIT loaders `three-blockbench` and `@bedrock-viewer/model-viewer`.
- RawSprite Minecraft can now import **Blockbench `.bbmodel`** and **Bedrock `.geo.json`** through the **Модель…** button in the 3D preview.
- Imported models are framed automatically, orbit with the mouse, support auto-rotate, and use the current canvas as their texture (BBModel materials are rebound to the current texture; Bedrock models receive a texture data URL).
- The preview can switch back to the player/elytra view with **Элитры**.
- The Minecraft app is now branded **RawSprite Minecraft** and saves `.mts`; RawSprite keeps `.rsp`.
- Model imports are a preview foundation: per-model UV painting, model persistence in projects and animations are the next step.
- Tests: 139 (model format detection plus the previous suite).
- Installers: RawSprite 0.1.2, RawSprite Minecraft 0.14.0.

## 0.13.2 — Selection transform fix

- Fixed the selection shrinking after a move/stretch on canvases larger than 64×32. The transform commit recalculated the selection with `blockSelection(scaled, x, y)` but omitted the document width/height, so it clipped to the legacy defaults and shrank on every drag.
- Both `commitSelectionTransform` and the rotate/flip `transformSelection` path now pass the real canvas dimensions.
- Added a regression test: a 20×20 selection on 128×64 survives two consecutive drags at 20×20.
- Tests: 136.
- Installers: RawSprite 0.1.2 and RawSprite Minecraft 0.13.2.

## 0.13.1 — Canvas interaction fixes

- Fixed the grid, selection overlay and shape preview: their SVG `viewBox` was still hard-coded to 64×32 while the canvas had arbitrary dimensions, so everything was scaled and clipped incorrectly on non-64×32 documents.
- Merged **Новый проект** and **Новый спрайт** into a single **Файл → Новый проект…** dialog. The tab “+” and `Ctrl+N` open the same size dialog; open/save/export remain separate.
- Texture import no longer stretches the image to the canvas. Images are read at native pixel size and placed at the top-left of the canvas; oversized images are clipped, with the dimensions reported in the status bar. This applies to both “Открыть текстуру” and “Импортировать как новый слой”.
- Zoom now goes down to 5% (or lower for fitting) and the wheel uses multiplicative steps, so a 2048×2048 canvas can be viewed as a whole. Added a **Вписать холст** toolbar button and context-menu action.
- New projects open at a fitted zoom; the RawSprite shell shows “СПРАЙТ” instead of the Minecraft “UV ATLAS” label.
- Tests: 135 (native-size placement, custom-canvas grid coordinates, merged new-project dialog, plus the previous suite).
- Installers: RawSprite 0.1.1 and RawSprite Minecraft 0.13.1.

## 0.13.0 — RawSprite split: two applications

- Extracted the framework-agnostic raster core into `@rawsprite/core`: colors, layers, shapes, texture operations, transforms, project validation and shortcuts.
- Extracted the shared UI into `@rawsprite/editor-ui`: Win9x primitives and XP icons, `TextureCanvas`, `PalettePanel`, `LayersPanel`, `ColorEditorWindow`, `ShortcutsModal`, `NewDocumentDialog`, the file-dialog service and the shared stylesheet.
- Moved the Minecraft runtime (`ElytraViewer`, UV-grid geometry, default elytra pixels, Steve/elytra assets) into `@rawsprite/plugin-minecraft`.
- Added `@rawsprite/editor-app`, a shared editor shell that takes a `mode` and an injected preview component. The base app passes no preview; the Minecraft app passes `ElytraViewer`.
- Created two Tauri applications:
  - **RawSprite** (`com.rawsprite.editor`, `.rsp`, no three.js/skinview3d);
  - **RawSprite Minecraft** (`com.rawsprite.minecraft`, `.mts`, live 3D preview).
- The RawSprite bundle is ~390 KB JS; the Minecraft bundle is ~920 KB.
- The canvas is no longer fixed at 64×32. Documents carry `width`/`height`, tools and transforms use explicit dimensions, and the **Новый спрайт…** dialog creates transparent canvases from 1×1 to 2048×2048 with size presets.
- Project format version 3 stores the canvas size; versions 1 and 2 still open as 64×32 documents and migrate on load. RawSprite saves `.rsp`, Minecraft saves `.mts`.
- Undo history is capped by canvas area so 2048×2048 documents do not try to retain 80 full snapshots.
- The 3D preview is skipped for non-64×32 documents instead of feeding an invalid cape atlas to skinview3d.
- Both NSIS installers build: `RawSprite_0.1.0_x64-setup.exe` and `RawSprite Minecraft_0.13.0_x64-setup.exe`.
- Tests: 132 (core extraction, arbitrary canvas creation/load/save, custom-canvas painting, project v3, a Minecraft-free RawSprite smoke render, plus all previous checks).

## 0.12.0 — One paint color, palette lock, Aseprite ellipse

- Removed the FG/BG pair entirely. The editor now has a single current color; both mouse buttons paint with it, the `X` swap shortcut is gone, and project settings no longer store a secondary color.
- Added a palette lock (button next to the palette selector, shortcut `A`) that starts **closed**. While locked, editing the wheel/HEX/RGB/HSV changes only the paint color, never the selected swatch; removing colors and renaming/deleting palettes are blocked.
- Added a “+” swatch at the end of the palette (and kept “В палитру”) that appends the current color **without unlocking**. The lock now protects existing samples instead of getting in the way of building a palette.
- Fixed the value-slider bug: moving brightness to 0 no longer loses hue/saturation or sends the wheel marker to the centre; raising brightness restores the color.
- Decluttered the palette dock: FG/BG and the six-icon palette action row are gone. Palette management now lives in a compact “…” menu; “В палитру / Из палитры” clearly belong to color editing.
- Fixed palette export: `.gpl` files now go through the native save dialog and Rust file write (browser fallback uses the File System Access API/download).
- Lowered the crouched elytra rig so the wings sit behind the shoulders instead of clipping into the back of the head.
- The 2D atlas is centered vertically and horizontally at every zoom level.
- Replaced the ellipse rasterizer with the Alois Zingl / Aseprite algorithm, including flat symmetric tops and Aseprite-style stepped sides.
- Duplicate colors are now first-class swatches: only the clicked index is highlighted, editing changes only that entry, cycling moves by index, and stored user palettes keep duplicates across reloads.
- Tests: 126 (palette lock/read-only swatch behavior, adding colors while locked, duplicate-swatch selection/editing, palette export, value-zero HSV retention, ellipse bounds/shape, plus the previous suite).

## 0.11.0 — Real `.mts` files, working PNG export and layout-independent keys

- Desktop save/open now use native Windows dialogs (`tauri-plugin-dialog`) and Rust file-write commands instead of anchor downloads. **Сохранить** (`Ctrl+S`) writes to the current `.mts` path or asks for one; **Сохранить как…** (`Ctrl+Shift+S`) always asks. **Открыть проект** uses the native open dialog.
- `.mts` sessions store layers, active layer, selection, editor settings (including zoom and skin), shortcuts and palettes. Opening a project restores all of it, and a subsequent `Ctrl+S` overwrites the same file.
- PNG export opens a native save dialog and writes only the flattened composite to the chosen path; the browser fallback uses the File System Access API when available.
- New projects now start with the bundled elytra texture and the default Steve skin, not an empty canvas.
- Keyboard shortcuts are layout-independent: Russian `ы` still fires `S`, `я` fires `Z`, and so on. Shortcut recording stores the same Latin keys. The old `U` conflict remains fixed (`U` rectangle, `Ctrl+U` UV).
- Tests: 118 (`.mts`/PNG file naming, layout-independent key mapping, new-project default texture, `Ctrl+S`/`Ctrl+Shift+S`).

## 0.10.1 — No browser dialogs, real defaults and XP icons

- Removed every `window.confirm` from the app. Closing a dirty tab and deleting a palette now use an in-app Win9x `ConfirmDialog`; “Очистить текущую текстуру” no longer asks at all (the action is undoable).
- Fixed the `U` collision: rectangle stays on `U`, the UV overlay moved to `Ctrl+U`. Stored shortcut maps are migrated on load, and a new test asserts unique default bindings.
- The initial project now contains the bundled `elytra.png` texture (the same pixels as the user's file), and the 3D preview uses `steve.png` as its default player skin. Imported skins and textures still override them.
- The 2D transparency checker is darker (`#8f8f8f` / `#b8b8b8`) so white and light pixels remain readable.
- Windows XP icons from the user's set are used for the brand mark, File/Edit/Layer menu actions, toolbar undo/redo, and confirmation dialog; the app and NSIS installer icon are generated from the XP Paint icon.
- Tests: 110 (default texture, no browser confirm, shortcut conflict migration, plus the 0.10.0 tab tests).

## 0.10.0 — Multiple projects in tabs, wider crouch wings

### Projects and tabs
- The editor now holds several documents at once. Every tab has its own layers, active layer, undo/redo history, selection, zoom, model skin and unsaved-changes flag; the clipboard is shared between projects.
- Added a Win9x-style document tab bar under the title bar: click to switch, middle-click or the × button to close, `+` to create a project, dirty dot per tab.
- File menu gained **Новый проект** (`Ctrl+N`) and **Закрыть проект** (`Ctrl+W`); `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle tabs. All are remappable in Settings → Hotkeys.
- “Открыть проект” opens the file in a new tab, except when the only tab is an untouched new document — then it is replaced. Closing a dirty tab asks for confirmation.
- Closing the window/browser tab warns when any project has unsaved changes.
- The filename field and tab titles update per document; saving writes the active project only.

### 3D preview
- The crouch pose now opens the elytra wings noticeably wider. Wing angles match the fully crouched frame of skinview3d's `CrouchAnimation` (0.72 rad outward, 0.30 rad spread), which follows the in-game crouch silhouette instead of the previous 0.40 rad guess.

### Tests
- Tests grew from 98 to 104: creating/switching tabs, per-tab pixels and history, dirty-close confirmation, opening a project as a new tab vs replacing a pristine tab, `Ctrl+N`/`Ctrl+Tab`.

## 0.9.1 — Color window fixes

- Turning the alpha slider to 0 no longer destroys the color: RGB is preserved in the color string (`#rrggbb00`) and the H/S/V/R/G/B sliders keep their values, so raising alpha restores the original color. Added `formatRgbaExact` for the picker while the compositing formatter keeps emitting `#00000000` for fully transparent pixels.
- The color window close button now works. The title bar no longer captures pointer events that originated on its buttons, so their click handlers fire.
- Removed the instructional hint at the bottom of the color window.
- Windows packaging: the identifier was changed from `com.minecrafttexturestudio.app` to `com.minecrafttexturestudio.editor` (removes the Tauri macOS-extension warning), `Cargo.lock` is committed for reproducible installer builds, and the NSIS `.exe` was built and verified locally (2.03 MiB, unsigned).
- Tests: 98 (alpha-zero round trip, close-button pointer flow, hint absence).

## 0.9.0 — Precise color editing, movable selections, pixel shape previews and a slimmer UI

### Color editing
- Added a floating color editor window (opened from the palette swatch, the sliders button or the HEX row). It has HSV sliders, RGB sliders, an alpha slider, HEX/HEXA input and a draggable title bar.
- Added an A/B comparison: the swatch on the left shows the color from when the window was opened, the right one shows the current color, with both HEX values. Clicking A restores the original color.
- Alpha is now a first-class channel: 8-digit HEX is accepted in the dock and the window, semi-transparent colors can be painted, and the eyedropper keeps the alpha it sampled.
- The palette dock wheel and value slider keep the current alpha instead of silently resetting it; the dock gains a sliders button next to HEX.

### Selection transform
- The marching-ants selection is now twice as visible: a dark outline, an animated white dash on top and a light tint inside.
- Added eight transform handles to the selection. Dragging inside the selection moves its pixels; dragging a corner or edge handle stretches them with nearest-neighbour sampling.
- Added rotate 90° clockwise/counter-clockwise, rotate 180° and flip horizontally/vertically buttons to the canvas header. The selection follows the transformed bounds.
- Every move, resize, rotation or flip is one undo step; Escape or pointer cancellation restores the untouched pixels and adds no history entry.
- Clicking inside a selection without moving it changes nothing and does not add an undo step.
- While transforming, the floating pixels are previewed in both the 2D canvas and the 3D model.

### Shape previews
- Rectangle, ellipse and line tools now preview the exact pixels in the drawing color instead of dashed vector outlines. The preview respects the active selection.

### Interface cleanup
- Removed the "PROJECT / Elytra Texture / 64×32" breadcrumb, the zoom slider and the duplicated top-right action buttons. Saving stays on `Ctrl+S` and in the File menu; skin import and reset are in File/Settings.
- The remaining toolbar is centred and keeps undo/redo, grid/UV toggles and the zoom −/percent/+ controls.

### Tests
- Tests grew from 70 to 96: color window sliders/alpha/A-B, 8-digit HEX through project save, HSV values preserved while V=0, selection move/resize/rotate/flip, transform undo, no-op click, Escape cancellation and the removed-UI smoke checks.

## 0.8.0 — Stroke-level undo, merged copy and a visible pointer cursor

### Undo
- A brush or eraser drag is now a single undo step. Previously every pointermove segment pushed its own history entry, so `Ctrl+Z` reverted a stroke pixel by pixel.
- 2D and 3D painting both group the whole stroke, separate strokes stay separate steps, and undo/redo finalize an in-progress stroke cleanly.
- Shape, fill, paste and layer operations still create exactly one step each.

### Clipboard and layers
- Added "Копировать объединённое" (`Ctrl+Shift+C`): copies the flattened visible stack instead of only the active layer.
- Added "Вставить в новый слой" (`Ctrl+Shift+V`): pastes the clipboard into a new layer above the active one and selects it.
- Added "Импортировать как новый слой…" to the File and Image menus: a PNG becomes a new layer instead of replacing the active layer. Plain "Открыть" still replaces the active layer.
- All new commands are available in the Edit/selection menus, the canvas context menu and the remappable shortcut list.

### Cursor
- The canvas now draws a small pointer dot at the exact mouse position, in addition to the highlighted target pixel.
- The target cell is shown for every tool: painting tools preview the resulting color (the eyedropper shows the sampled color), while the selection and shape tools show a dashed outline.
- Removed the old per-tool native crosshair override; the dot is the single canvas cursor.

### Tests
- Unit/integration tests grew from 65 to 70: a full drag now reverts in one undo step, separate strokes remain separate steps, paste-into-new-layer works and undoes in one step, copy-merged captures lower layers while an empty layer is active, and the pointer dot/target cell render for painting and shape tools.

## 0.7.0 — Layers, selection, shape tools and the in-dock palette

### Layers
- Added a real layer stack: create, duplicate, delete, rename (double click or context menu), reorder up/down, merge down, hide/show, and per-layer opacity.
- Painting, erasing, filling, pasting and shape tools write to the active layer; the 2D canvas, 3D preview and PNG export show the flattened composite.
- Hidden layers cannot be edited by accident; the status bar explains why.
- Each layer operation and pixel edit is undoable; an opacity slider drag counts as one undo step.
- The layer panel sits under the palette dock with visibility toggles, an active-layer highlight, an opacity badge and a compact action bar.
- `.mts` projects now save as format version 2 with layers, active layer, visibility and opacity. Version 1 projects still open and are migrated into a single layer.

### Selection
- Added the rectangular selection tool (`M`): drag a marquee, click to deselect.
- The selection clips brush strokes, the eraser, flood fill, line/rectangle/ellipse drawing and pasting.
- Added copy/cut/paste with an internal pixel clipboard (`Ctrl+C` / `Ctrl+X` / `Ctrl+V`), clear selection (`Delete`), select all (`Ctrl+A`) and deselect (`Ctrl+D`).
- The active selection is drawn as a dashed marching-ants marquee and its size is shown in the canvas header.

### Shape tools
- Added line (`L`), rectangle outline (`U`) and ellipse outline (`O`) tools with a dashed live preview while dragging.
- Shapes are rasterized onto the active layer and respect the active selection.

### 3D preview
- Fixed the 3D pixel grid toggle: the line geometry was created but never assigned to the ref the toggle iterated, so the switch did nothing.
- The grid is now a thin, semi-transparent light-blue guide. Segments are emitted on both sides of the wing surface so the grid stays visible from either side with depth testing on.
- Selection and shape tools leave 3D camera orbiting intact; the viewer hint explains that those tools work on the 2D atlas.

### Palette dock
- Removed the separate palette configurator dialog entirely. Palette management now lives in the palette dock: new, duplicate, rename (inline), delete, import and export.
- Added inline color add/delete buttons next to the HSV wheel, HEX field and FG/BG slots.
- The palette dropdown no longer loses the “Мои цвета” entry when its last color is removed.
- Palette rename commits on Enter or blur and cancels with Escape without saving a half-typed name.

### Tests and internals
- Added `src/utils/layers.ts` (compositing, merge, reorder), `src/utils/shapes.ts` (Bresenham lines, rectangle/ellipse outlines, selection helpers) and `src/utils/project.ts` (project layer validation).
- Extended `src/utils/texture.ts` with selection-clipped painting, region copy/paste and range-limited flood fill.
- Unit tests grew from 14 to 65: layer compositing, shape rasterization, project parsing, a server-rendered App smoke test, jsdom interaction tests for layer management and selection, project save/load/migration coverage, and 3D UV-grid geometry generation.
- Clearing/opening a project also resets the internal clipboard.

## 0.6.3 — Fix pass: build, input handling, packaging

### Build and tooling
- Fixed `npm run build`: removed an unused `DoubleSide` import that made `tsc -b` fail with TS6133.
- Added `npm run typecheck`, `npm test` and `npm run test:watch` scripts.
- Added Vitest with 14 unit tests for texture raster helpers (`pixelIndex`, `floodFill`) and color math (`normalizeColor`, hex/RGB/HSV conversion).
- Extracted the color helpers from `PalettePanel` into `src/utils/color.ts` so they can be tested.
- Split the production bundle into app/react/three chunks and raised the chunk warning limit; the shell is now ~72 kB instead of one 824 kB bundle.
- `.tmp/` is ignored by git; builds in locked-down environments can point `TEMP`/`TMP` there.

### Editor fixes
- The unsaved-changes dot now reflects real state: it appears on any edit and clears when a `.mts` project is saved or opened. The browser tab title shows the same marker.
- `X` (swap FG/BG) is now a configurable shortcut instead of a hardcoded key, appears in the shortcut editor under "Редактирование", and is listed in menus with the live binding.
- Shortcut labels in the 2D canvas context menu and top-bar tooltips follow the user's bindings instead of hardcoded defaults.
- The shortcut dialog now detects conflicts, refuses to bind an already-used combination, keeps a single capture listener while reassigning, and cancels cleanly when closed.
- The eyedropper still restores the previous tool, and the 2D wheel zoom uses a native non-passive listener so it stops fighting the canvas scroller.
- Right-click handling is deterministic on Windows/Chromium: `contextmenu` fires on press, so painting tools now defer the menu until release, and a background-color right-drag no longer leaves an open menu behind.
- The 3D viewer drops stale right-press state on pointer cancellation, so a right-drag that never reaches the paint threshold can no longer freeze camera orbiting.
- Context menus restore keyboard focus to their trigger on Escape or after choosing an item, and close on window resize.
- PNG export always writes a `.png` name and defers revoking the object URL, which fixes cancelled downloads in some WebView2 builds.
- Texture import reports the source dimensions and warns when a non-64×32 image is stretched to the atlas.
- Opening a project without a saved model skin resets the preview skin instead of keeping the previous one.
- The palette configurator is opened through a request token ref rather than an exhausted-deps effect.
- The palette rename button uses a pencil icon instead of the settings gear.

### Interface
- Removed unreachable legacy CSS (old sidebars, UV mini-map, document footer, toggle switch and preview footer) and duplicate checkerboard/layout declarations; `styles.css` dropped from 845 to ~715 lines with no selector changes for rendered markup.
- Added a conflict style for the shortcut editor.

### Desktop packaging
- Added generated app icons (`src-tauri/icons/`) and wired them into `bundle.icon`.
- Added `src-tauri/capabilities/default.json` with `core:default` permissions and an explicit `main` window label.
- Bumped package, Tauri, Cargo and document versions to 0.6.3.

> Rust is not installed in this environment, so `npm run tauri build` was not executed. Run it on a machine with the Tauri prerequisites before shipping an installer.

## 0.6.2
- Replaced the 3D grid texture overlay with actual Three.js line geometry generated from the elytra mesh UV coordinates.
- Pixel-boundary lines are interpolated through each mesh triangle and rendered slightly offset above the surface.
- Depth testing stays enabled so the grid follows visible surfaces rather than drawing through the wings.
- Grid visibility still follows the existing 3D grid toggle.

## 0.6.1 — View-mode grid toggle and checkerboard fix

- The main grid toolbar button now toggles the 3D model grid while in 3D-only mode; in 2D and split modes it toggles the 2D pixel grid. The 3D viewport retains its own grid toggle in all visible modes.
- Replaced the checkerboard SVG data URI with a base64-encoded SVG to avoid unescaped whitespace in CSS URLs.
- Bumped package/Tauri/Cargo version to 0.6.1.

## 0.6.0 — Workspace, grid, zoom and project fixes

- Replaced implicit grid auto-placement with named CSS grid areas for 2D, split and 3D-only modes; the tool dock remains on the right in 3D-only mode.
- Made the 2D transparency checkerboard a repeating square SVG pattern to prevent diagonal gradient artifacts; increased its cell size.
- Kept the 2D pixel grid as an SVG overlay and separated the 3D grid from the texture material, with stronger line contrast and explicit render on toggle.
- Shift/crouch preview now uses a moderate wing spread instead of the 90-degree flying pose.
- Increased the maximum 2D zoom to 2048 CSS pixels per texture pixel and changed the zoomable stage so very large canvases remain scrollable.
- The eyedropper returns to the previous tool in both 2D and 3D, even when the picked pixel is transparent.
- Hid the left-dock branding/footer and the persistent 3D hint strip; toolbar controls use hover tooltips instead.
- Kept shortcut configuration available from the Settings menu only; `Ctrl+S` saves the `.mts` project and `Ctrl+Shift+E` exports PNG.
- Project saving includes the texture, editor settings, current view and zoom, imported skin data, shortcut bindings and palette data from local storage.
- Updated package, Tauri, Cargo and UI version to 0.6.0.

## 0.5.0 — Workspace stability and color-editor improvements

- Stabilized 2D/3D layout assignments and split the pixel-grid from the texture pixels.
- Added initial `.mts` project save/open support.
- Added project-restored palette data and live RGB slider gradients.

## 0.4.0 — Retro interface and context menus

- Reworked the interface to use a Windows 95/98 and early Windows XP visual language.
- Added keyboard-navigable contextual menus.
- Added import/export/clear commands to the 2D canvas context menu.
- Shift crouch preview started as an editor composition pose; 0.6.0 now uses a modest partially open wing angle.

