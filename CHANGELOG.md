# Changelog

All notable feature implementations, bug fixes, debuggings, and build/deployment updates for **WebPraat** are documented below on a per-commit basis (newest first).

---

## `HEAD` — 2026-11-02
**`fix(script): resolve WASM binary URL loading, fix New/Open Praat script sync & alerts, and add CHANGELOG.md`**

- **Debugging & Bug Fixes**:
  - **WASM Instantiation `CompileError` (`expected magic word 00 61 73 6d, found 3c 21 44 4f`)**:
    - Fixed single-quoted string literals (`'${import.meta.env.BASE_URL}praatlib.wasm'` in `src/workers/praatWorker.ts` and `'${import.meta.env.BASE_URL}recorder-worklet.js'` in `src/utils/recorder.ts`) that prevented template interpolation and caused the browser to request a literal `${import.meta.env.BASE_URL}...` path, receiving an HTML `<!DOCTYPE` SPA fallback (`0x3c 0x21 0x44 0x4f`) instead of the WebAssembly binary.
    - Resolved relative `base: './'` Web Worker URL mismatch where worker bundles emitted under `dist/assets/praatWorker-*.js` (or `/src/workers/praatWorker.ts` in dev) resolved `./praatlib.wasm` relative to the worker subdirectory rather than the application root. Main-thread initialization (`getPraatWorker()` in `src/utils/audio.ts`) now computes `new URL('./praatlib.wasm', document.baseURI).href` and passes it to the worker via `setWasmUrl()`, backed by `resolvePraatWasmUrl()` path resolution for root domains, GitHub Pages subpaths, Vite dev, and Node/Vitest.
    - Added failure recovery in `ensureInit()` so failed WASM module instantiation resets worker state cleanly instead of leaving partially initialized state.
  - **Script Import Synchronization & User Feedback (`Praat > Open Praat script...` & `ScriptConsole`)**:
    - Fixed CodeMirror 6 `EditorView` in `ScriptConsole.tsx` only reading `scriptTextAtom` once on initial mount, which previously left the editor content unchanged when importing a script while the `Praat Script` tab was open. Added reactive `EditorView` document dispatch synchronization and focus management via `scriptRevisionAtom` and `scriptNameAtom`.
    - Added explicit browser `alert()` dialogs confirming successful script import (displaying the loaded filename) or reporting file read errors, alongside active script filename badges in the `Praat Script` tab header and `ScriptConsole` toolbar.
  - **New Script Creation (`Praat > New Praat script`)**:
    - Fixed `New Praat script` previously acting as a no-op when the `Praat Script` tab was already active. Clicking `New Praat script` (or the new toolbar `New` button) now clears the CodeMirror document to an empty script, resets the filename to `untitled.praat`, switches to and focuses the script editor, and updates the status bar.
  - **Info Window `clearinfo` / `writeInfoLine` Handling**:
    - Updated `ScriptConsole` execution to read live CodeMirror buffer contents directly, reset `InfoWindow` output when `clearinfo` or `writeInfoLine` is executed, and surface `Error:` responses in the status bar.
- **Testing & Documentation**:
  - Added regression tests in `src/phase6.test.ts` covering `resolvePraatWasmUrl()` across custom URLs, Vite dev workers, `/assets/` production bundles (root and GitHub Pages subpath), and Node/Vitest environments, plus EN/KO localization parity for script feedback strings.
  - Created `CHANGELOG.md` logging key changes across every commit in repository history.

---

## `de2a6fe` — 2026-11-02
**`chore: edited readme.md`**

- **Documentation**:
  - Added upstream Praat commit reference (`f9409a4d59c9bd99967ce36273ca87a64b4c2be3`), project origin notes, and contact details to `README.md`.

---

## `67a7436` — 2026-11-02
**`docs: added readme.md and ./docs/`**

- **Documentation**:
  - Streamlined the `README.md` top header section formatting.

---

## `1ed0402` — 2026-11-02
**`docs: add project README and copy architecture and planning docs to docs/`**

- **Documentation**:
  - Copied the four core design and planning specifications (`agents.md`, `praat_architecture.md`, `webpraat_architecture.md`, `webpraat_plan.md`) into `docs/`.
  - Authored comprehensive `README.md` outlining hybrid C++/WASM + React architecture, DSP capabilities, directory structure, build prerequisites, deployment headers, and upstream credits.
  - Localized `sourceGithub` label in `ko.ts`.

---

## `88d8b18` — 2026-11-02
**`feat(menu): link Praat menu last item to GitHub source repository`**

- **Feature Implementation**:
  - Replaced the last item in the top-bar `Praat` menu (`About WebPraat...`) with `Source (GitHub)` linking directly to `https://github.com/gggentooo/webpraat` (`About WebPraat...` remains accessible under `Help`).
  - Added `sourceGithub` localization entries in `en.ts` and `ko.ts`.

---

## `61f2bdf` — 2026-11-02
**`chore: added CNAME file`**

- **Deployment**:
  - Added `CNAME` (`webpraat.lnaba.reisen`) for custom domain routing on GitHub Pages.

---

## `6a46390` — 2026-11-02
**`fix(ci): define packages field in pnpm-workspace.yaml for pnpm 9 compatibility`**

- **Debugging & CI Fix**:
  - Resolved GitHub Actions build failure (`ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` / `packages field missing or empty`) by declaring `packages: - '.'` in `pnpm-workspace.yaml` and moving `onlyBuiltDependencies` (`esbuild`) into `package.json`.
  - Restored `ko.app.title` (`WebPraat (웹프랏)`) to satisfy Phase 3 localization parity tests.

---

## `e2a2f70` — 2026-11-02
**`feat(github pages): add github pages deployment files`**

- **Deployment & Infrastructure**:
  - Added `.github/workflows/deploy.yml` GitHub Actions workflow for automated static builds and GitHub Pages deployment.
  - Added `public/coi-serviceworker.js` and registered it in `index.html` to inject `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers via Service Worker (enabling `SharedArrayBuffer` on static hosts without custom HTTP header support).
  - Configured relative asset base (`base: './'`) in `vite.config.ts`.

---

## `1ab59d2` — 2026-11-02
**`fix(ui): disable line breaks in all menu buttons and action toolbars`**

- **UI Bug Fix**:
  - Prevented button label wrapping and vertical misalignment—especially noticeable in Korean (`한국어`) localization—by adding global `button { white-space: nowrap; }` rules in `src/index.css` and `whitespace-nowrap` / `w-max` layout classes across `MenuBar`, `TextGridMenuBar`, `ObjectsPanel`, `SoundEditor`, `TextGridEditor`, `ScriptConsole`, `PictureWindow`, `InfoWindow`, and modals.

---

## `48dfa45` — 2026-11-02
**`fix(layout): add min-width and min-height restraints to outermost GUI wrapper with scrollbars on small viewports`**

- **Layout Bug Fix**:
  - Added `min-w-[1200px] min-h-[680px]` constraints to the outermost application wrapper inside a scrollable viewport container in `src/App.tsx` and `src/index.css`, ensuring top-bar and editor menu items never clip off-screen on narrow or short browser windows.

---

## `3c1517a` — 2026-11-02
**`feat(textgrid): implement Phase 8 - TextGrid editor menu bar, interval & boundary operations, and tier management`**

- **Feature Implementation (Phase 8)**:
  - Implemented dedicated desktop-Praat-style `TextGridMenuBar` with **File**, **Edit**, **Query**, **Select**, **Interval**, **Boundary**, and **Tier** menus plus keyboard shortcuts (`Enter`, `Cmd/Ctrl+Enter`, `Alt+Backspace`, interval navigation).
  - Added interval operations (`New interval on tier...` splitting `[selStart, selEnd]`, `Remove interval`, `Set interval text...`, `Clear interval text`), boundary operations, and interactive Praat cursor boundary circle buttons rendered on tiers.
  - Implemented tier management (`Add interval tier...`, `Add point tier...`, `Duplicate tier...`, `Rename tier...`, `Remove tier`) backed by new C++ WASM bridge functions (`praat_bridge_textgrid_add_tier`, `remove_tier`, `duplicate_tier`, `rename_tier`) integrated with Undo/Redo and OPFS persistence.
  - Added bilingual EN/KO menu and modal translations and `src/phase8.test.ts` acceptance suite.

---

## `bf7ad56` — 2026-11-02
**`feat(editor): add undo/redo functionality to TextGrid & Picture windows, bottom bar buttons, and keyboard shortcuts`**

- **Feature Implementation**:
  - Created generic snapshot history hook (`src/hooks/useUndoRedo.ts`) supporting `Ctrl/Cmd+Z` (Undo) and `Ctrl+Y` / `Cmd+Shift+Z` (Redo) while safely ignoring native text `<input>`/`<textarea>` focus.
  - Integrated Undo/Redo into `TextGridEditor` (synchronizing restored `TextGridData` back into WASM via `praat_bridge_textgrid_replace_from_file`) and `PictureWindow` (`pictureCommandsAtom` drawing history).
  - Added `undo` and `redo` buttons alongside `all`/`in`/`out`/`sel`/`bak` in the editor bottom bar and added `src/undoRedo.test.ts`.

---

## `b711ad8` — 2026-11-01
**`fix(textgrid): align waveform viewport and time ruler with tier label column`**

- **UI & Alignment Bug Fix**:
  - Added a synchronized left gutter matching the right-side tier header width in `TextGridEditor` so the upper waveform/spectrogram canvas and time axis ruler align pixel-for-pixel with `TextGridTiersCanvas` boundaries below.

---

## `0138fcd` — 2026-11-01
**`feat(advanced): implement Phase 7 - AudioWorklet recording, PictureWindow, dwtools/LPC/artsynth DSP & OPFS persistence`**

- **Feature Implementation (Phase 7)**:
  - **Microphone Recording**: Implemented `public/recorder-worklet.js` (`AudioWorkletProcessor`), `src/utils/recorder.ts`, and `SoundRecorderModal.tsx` with live peak/RMS metering, clipping indicator, playback preview, and direct registration as Praat `Sound` objects.
  - **Praat Picture Window**: Implemented 12" × 12" vector drawing canvas (`PictureWindow.tsx`, `pictureRenderer.ts`) supporting Praat viewport selection, pen styles/colours, garnish axes, object drawing (`Sound`, `Pitch`, `Spectrogram`, `Formant`, `Intensity`, `TextGrid`), script drawing commands, and SVG/PNG export.
  - **Advanced C++ DSP Modules**: Enabled `LPC`, `dwtools` subset, and `artsynth` in `wasm/CMakeLists.txt` and `praat_bridge.cpp` for PowerCepstrogram & Cepstral Peak Prominence (`CPP` / `CPPS`), `LPC (burg)`, `MFCC`, `KlattGrid` synthesis, and articulatory synthesis (`Speaker` + `Artword`).
  - **Workspace Persistence**: Implemented automatic Origin Private File System (`OPFS`) caching and restoration (`src/utils/persistence.ts`) across reloads, plus `src/phase7.test.ts`.

---

## `c0ecd02` — 2026-11-01
**`chore: update favicon from favicon_io`**

- **Assets**:
  - Added `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, and `apple-touch-icon.png` in `public/` and linked them in `index.html`.

---

## `5210a7f` — 2026-11-01
**`feat(script): implement Phase 6 - Scripting Console, CodeMirror 6 syntax highlighting & WASM interpreter`**

- **Feature Implementation (Phase 6)**:
  - Embedded CodeMirror 6 in `ScriptConsole.tsx` with a custom Praat Script stream syntax highlighter (`praatSyntax.ts`), sample batch scripts, and `Mod-Enter` execution shortcut.
  - Implemented `praat_bridge_execute_script()` in C++ wrapping Praat's `Interpreter` / `praat_executeScriptFromText`, intercepting `writeInfoLine` / `appendInfoLine` (`Melder_info`) into `InfoWindow`, and synchronizing created/removed WASM objects with `ObjectsPanel`.
  - Added `src/phase6.test.ts` acceptance tests.

---

## `db0ce65` — 2026-11-01
**`feat(textgrid): implement Phase 5 - TextGrid Editor, Annotation, and .TextGrid File I/O`**

- **Feature Implementation (Phase 5)**:
  - Mapped Praat `IntervalTier` and `TextTier` structures between C++ WASM (`praat_bridge_textgrid_*`) and TypeScript (`src/utils/textgrid.ts`), including full `.TextGrid` text format parsing and serialization.
  - Built `TextGridEditor`, `TextGridTiersCanvas`, and Unicode `IPAPalette` supporting synchronized waveform display, boundary insertion/dragging, inline interval/point text editing, and `.TextGrid` import/export (`src/phase5.test.ts`).

---

## `321136b` — 2026-11-01
**`feat(editor): implement Phase 4 - SoundEditor, WaveformCanvas, SpectrogramCanvas with overlays, and playback engine`**

- **Feature Implementation (Phase 4)**:
  - Implemented `useViewport` synchronized time-axis zoom/scroll (`all`, `in`, `out`, `sel`, `bak`) and cursor/range selection.
  - Built `WaveformCanvas` (min/max envelope decimation + sample rendering) and `SpectrogramCanvas` (`ImageData` rendering with Praat greyscale/colour dynamic-range LUTs) with toggleable acoustic overlays: Pitch contour (blue), Formant tracks (red speckles), and Intensity curve (green).
  - Implemented `useAudio` Web Audio `AudioBufferSourceNode` range/window playback with a 60fps `requestAnimationFrame` playhead cursor (`src/phase4.test.ts`).

---

## `2081135` — 2026-11-01
**`feat(ui): implement Phase 3 - Application Shell, ObjectsPanel, InfoWindow, and i18n`**

- **Feature Implementation (Phase 3)**:
  - Created Jotai state store (`src/store/index.ts`) managing Praat object inventory, multi-selection, active tabs, Info window output, and modals.
  - Implemented desktop-inspired application shell (`MenuBar`, `ObjectsPanel` with selection-driven dynamic action sidebar, `InfoWindow`, parameter `ModalDialog`) and full English/Korean (`en.ts`, `ko.ts`) internationalization (`src/phase3.test.ts`).

---

## `6fbaae7` — 2026-11-01
**`feat(worker): implement Phase 2 - Web Worker, audio decoding & export, Comlink bridge`**

- **Feature Implementation (Phase 2)**:
  - Created background Web Worker (`src/workers/praatWorker.ts`) instantiating `praatlib.wasm` off the UI thread and exposing a strongly typed RPC interface via `Comlink`.
  - Implemented `src/utils/audio.ts` supporting native browser audio decoding, WASM memory fallback decoding (WAV/FLAC/MP3/Vorbis/AIFF), and 16-bit PCM RIFF WAV export (`src/phase2.test.ts`).

---

## `8288fbe` — 2026-11-01
**`feat(wasm): implement Phase 1 - WASM core, C bridge, and acceptance tests`**

- **Feature Implementation & Initial Porting (Phase 1)**:
  - Configured headless Emscripten CMake build (`wasm/CMakeLists.txt`, `wasm/scripts/build.sh`) compiling upstream Praat C++17 modules (`kar`, `melder`, `dwsys`, `stat`, headless `sys`, `fon`, `gsl`, `clapack`, `flac`, `mp3`, `vorbis`, `opusfile`) into `public/praatlib.wasm` and `public/praatlib.js`.
  - Implemented C bridge (`wasm/bridge/praat_bridge.h`, `praat_bridge.cpp`) with integer-handle object table management and core `Sound`, `Pitch`, `Formant`, and `Spectrogram` creation and analysis functions.
  - Added Phase 1 WASM parity tests (`src/wasm.test.ts`, `test_phase1.mjs`).
