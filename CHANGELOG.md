# Changelog

All notable feature implementations, bug fixes, debuggings, and build/deployment updates for **WebPraat** are documented below on a per-commit basis (newest first).

---

## `HEAD` — 2026-11-03
**`feat(phase10): implement automated script file synchronization, change tracking & export fallback`**

- **Feature Implementations & Core Infrastructure**:
  - **VFS Change Tracking & Manifest Diffing (`src/workers/praatWorker.ts`)**:
    - Implemented in-worker recursive filesystem scanning and snapshot diffing (`scanVfsRecursively`, `takeVfsSnapshot`, `getModifiedVfsEntries`) against Emscripten MEMFS (`Module.FS`).
    - Captured file paths, sizes, modification timestamps (`mtime`), and 32-bit FNV-1a byte hashes as pre-execution baselines.
    - Exposed typed RPC methods: `getModifiedVfsFiles(baseDir?: string)`, `readVfsFile(path: string)`, and `resetVfsSnapshot(baseDir?: string)`.
    - Automatically updated baseline snapshot upon directory mounting (`mountFiles`) so existing files are excluded from change manifests.
  - **Headless Audio Export Actions in C++ WASM Core (`wasm/bridge/praat_bridge.cpp`)**:
    - Registered headless Praat audio export actions: `Save as WAV file...`, `Save as 24-bit WAV file...`, `Save as 32-bit WAV file...`, `Save as FLAC file...`, and `Save as AIFF file...` via `Sound_saveAsAudioFile()`.
    - Enables standard Praat batch commands (such as `selectObject: id; Save as WAV file: path$`) to output directly to the virtual filesystem.
  - **Automated Host Disk Synchronization (`src/hooks/useScriptExecution.ts`, `src/utils/vfs.ts`)**:
    - Implemented `writeHostFile()` recursive path resolution and directory creation using the File System Access API (`FileSystemDirectoryHandle`).
    - On script completion (`COMPLETED`) or suspension (`PAUSED`), automatically traversed detected modified/created files and persisted them directly to the host computer's hard drive without manual user intervention.
    - Added non-intrusive status confirmations (e.g. `Saved {file} to disk`, `Saved {count} modified files to disk`).
  - **Interactive Script Step Auto-Sync (`src/components/TextGridEditor/TextGridEditor.tsx`)**:
    - Registered `activeEditorSaveCallbackAtom` in `TextGridEditor` that auto-commits pending text edits, serializes grid data, and synchronizes with WASM and mounted host folder.
    - In interactive stepping scripts (e.g., `00_open_for_transcription.praat`), automatically invokes the active editor save callback when the user clicks `[Next]` in `ScriptPauseWindow` before Praat executes `Remove`, completely eliminating annotation data loss.
  - **Standalone Pure TypeScript ZIP Archive Generator (`src/utils/zip.ts`)**:
    - Created zero-dependency PKWARE-compliant uncompressed ZIP archive generator with IEEE 802.3 CRC-32 checksum computation (`createZipArchive`, `crc32`).
  - **Browser Download & Export Fallback Modal (`src/components/ScriptConsole/ScriptExportModal.tsx`)**:
    - For unmounted contexts or read-only fallbacks (Safari/Firefox): automatically triggers a browser download for single output files, or presents a multi-file export modal with individual download options and `[Download All (.zip)]` archive generation.
  - **Localization & Unit Testing**:
    - Added 12 new localization keys to `src/config/locales/en.ts` and `ko.ts` maintaining 100% parity (`fileSavedToDisk`, `filesSavedToDisk`, `fileDownloaded`, `filesReadyForDownload`, `scriptExportTitle`, `scriptExportPrompt`, `downloadZip`, `downloadFile`, `newBadge`, `modifiedBadge`, `close`, `autoSaveStep`).
    - Created comprehensive test suite `src/phase10.test.ts` (8 tests) covering VFS diffing, script writing/appending, object save commands, mock host directory synchronization, ZIP binary generation, and localization parity (89/89 total unit tests passing).

---

## `f261d61` — 2026-11-03
**`fix(script): resolve vertical scrollbar in Praat script window top menu bar`**

- **UI & Layout Fixes**:
  - Fixed top menu bar container height (`h-10`) in `ScriptConsole.tsx` and added `overflow-y-hidden` alongside `overflow-x-auto` to strictly prevent vertical scrollbar rendering.
  - Standardized all child element heights to fixed `h-7` (28px) with `flex items-center justify-center` across all buttons, filename badge, shortcut indicator, and sample scripts select dropdown.
  - Reset vertical padding and line-height on native `<select>` element (`py-0 leading-none h-7`) to eliminate cross-platform intrinsic height expansion.
  - Added defensive `overflow-y-hidden` across editor tab bar (`App.tsx`) and playback toolbars (`SoundEditor.tsx`, `TextGridEditor.tsx`, `PictureWindow.tsx`).

---

## `54388e3` — 2026-11-02
**`docs: add comprehensive English and Korean user manuals in docs/`**

- **User Documentation**:
  - Authored student-oriented English manual [`docs/manual_en.md`](./docs/manual_en.md) and fully synchronized Korean manual [`docs/manual_ko.md`](./docs/manual_ko.md) tailored for linguistics and phonetics students.
  - Aligned 100% of Korean menu items, commands, dynamic actions, dialog titles, units, and status messages verbatim with `src/config/locales/ko.ts`.
  - Documented all top menu bar items (`Praat`, `New`, `Open`, `Save`, `Help`, `Language`), the Objects list and dynamic action buttons for every object type (`Sound`, `Pitch`, `Formant`, `Spectrogram`, `Intensity`, `TextGrid`, `PowerCepstrogram`, etc.).
  - Documented the Sound Editor (waveform, spectrogram, pitch/formant/intensity overlays, viewport zoom, playback), TextGrid Editor (tier operations, boundary circles, IPA palette, shortcuts), Praat Picture (viewports, drawing, styling, PNG/SVG export), Sound Recorder (mono/stereo, VU meter, sample rates), Praat Script Console (running scripts, forms, pause windows, local folder mounting), Info Window, OPFS workspace persistence, and a keyboard shortcuts table.
  - Linked both `docs/manual_en.md` and `docs/manual_ko.md` under `## Documentation` in `README.md`.

---

## `1d01ea9` — 2026-11-02
**`docs(license): add WebPraat Non-Commercial & Attribution license and update project metadata`**

- **Licensing & Documentation**:
  - **License Document (`LICENSE`)**:
    - Created comprehensive license document inheriting free use from Praat's open-source heritage for personal, educational, and academic research purposes.
    - Added mandatory attribution clause requiring all redistributions, forks, or derivative works to retain copyright notices and credit `gggentooo/webpraat` (`https://github.com/gggentooo/webpraat`) as well as original Praat creators (Paul Boersma & David Weenink).
    - Enforced strict non-commercial restriction prohibiting any revenue generation, commercial sale, licensing, paywalls, or monetized deployments derived from repository code or built applications without prior written consent.
    - Included full text of the GNU General Public License v3.0 (GPL-3.0) for compliance with the upstream C++ Praat DSP core.
  - **Metadata & Documentation (`package.json`, `README.md`)**:
    - Updated `package.json` with `"license": "SEE LICENSE IN LICENSE"`.
    - Updated `README.md` `Credits & License` section detailing the free use, attribution to `gggentooo/webpraat`, and non-commercial terms.

---

## `b06f52a` — 2026-11-02
**`feat(phase9): implement interactive scripting, form/pause dialogs & local directory mounting`**

- **Feature Implementations**:
  - **Script `form ... endform` Parser & Parameter Extraction (`praat_bridge_parse_script_form`)**:
    - Invoked Praat's native `Interpreter_readParameters` in C++ WASM bridge to extract dialog title, comments, and typed parameter definitions (`sentence`, `word`, `text`, `integer`, `real`, `positive`, `natural`, `boolean`, `choice`, `optionmenu`, `folder`, `infile`, `outfile`).
    - Exposed structured JSON metadata via `praatWorkerApi.parseScriptForm()`.
  - **Dynamic React `ScriptFormModal` (`src/components/ScriptConsole/ScriptFormModal.tsx`)**:
    - Prompts user before script execution when forms are present, pre-populating fields with default values.
    - Added one-click "Use mounted folder" shortcut for `folder` / `infile` / `outfile` parameters when a local directory is mounted.
    - Injected form arguments into script interpreter via `praat_bridge_execute_script_with_args()`, binding lowercase/uppercase variables (e.g. `wav_folder$`, `skip_done`) with exact desktop Praat parity.
  - **Local Directory Mounting & Virtual Filesystem (`src/utils/vfs.ts`)**:
    - Implemented "Mount Local Folder..." using browser File System Access API (`window.showDirectoryPicker({ mode: 'readwrite' })`) with `<input type="file" webkitdirectory>` fallback.
    - Mirrored directory trees into Emscripten virtual filesystem (`Module.FS`) at `/workspace/<folderName>`, synchronized working directory (`Melder_setCurrentFolder` / `defaultDirectory$`), and verified `Create Strings as file list`, `fileReadable()`, and `Read from file` resolution.
    - Implemented two-way write-back utility (`writeBackFile`) so changes to TextGrids are written to both MEMFS and the host OS directory handle.
  - **Headless Commands & Recognizers Registration (`wasm/bridge/praat_bridge.cpp`)**:
    - Registered `s_soundFileRecognizer` via `Data_recognizeFileType` for WAV, AIFF, FLAC, and MP3 files.
    - Registered headless commands `Create Strings as file list...`, `Create Strings as folder list...`, and `Strings` query actions.
    - Registered `TextGrid` query and modification actions (`Get number of tiers`, `Get tier name...`, `Get number of intervals...`, `Get label of interval...`, `Get interval at time...`, `Set interval text...`, `Insert interval tier...`, `Insert point tier...`, `Remove tier...`, `Insert boundary...`, `Remove boundary at time...`).
    - Registered time queries `praat_TimeFunction_query_init` for `classSound` and `classTextGrid` enabling `Get total duration`, `Get start time`, `Get end time`.
    - Unified `theCurrentPraatObjects` with bridge object allocation via `register_new_object`, ensuring bridge objects and script objects share the same ID space.
  - **Script Editor Action Dispatch (`Edit` / `View & Edit`)**:
    - Registered headless callbacks `WEB_DO_Sound_TextGrid_edit`, `WEB_DO_Sound_edit`, and `WEB_DO_TextGrid_edit` emitting structured `EditorOpenEvent` (`{ action: 'open', editor: 'TextGridEditor'|'SoundEditor', soundId, textGridId }`).
    - Integrated with `useScriptExecution` to automatically switch active tabs to `TextGridEditor` or `SoundEditor` with matching object selections.
  - **Non-Blocking Coroutine Pause & Resume Window (`ScriptPauseWindow.tsx`)**:
    - Hooked `UiPause_begin` / `UiPause_end` (`UiPause.cpp`) into `InterpreterStack::haltAll()` and `resumeFromTop()`, returning `PAUSED` status with dialog title, comments, and button configurations.
    - Built draggable, floating non-modal `ScriptPauseWindow` floating above the workspace, keeping audio playback, waveform navigation, and TextGrid editing unblocked while paused.
    - Added `resumeScript(clickedButton)` and `abortScript()` actions to step through batch scripts (e.g. `[Next]`, `[Stop]`) and cleanly interrupt execution.
  - **TextGrid Editor Quick Save (`Ctrl/Cmd+S`)**:
    - Updated `handleExportTextGrid` in `TextGridEditor.tsx` to automatically save active TextGrid back to mounted VFS and host filesystem handle with toast notification, falling back to download blob if no folder is mounted.
  - **Localization & Testing**:
    - Added all form modal, pause window, quick save, and directory mounting strings to `src/config/locales/en.ts` and `ko.ts` maintaining 100% key parity.
    - Authored comprehensive test suite `src/phase9.test.ts` (12 tests) covering form parsing, parameter binding, VFS operations, recognizer loading, editor event dispatch, coroutine pause/resume, end-to-end transcription script simulation, and localization parity (81/81 total unit tests passing).

---

## `e79e612` — 2026-11-02
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
