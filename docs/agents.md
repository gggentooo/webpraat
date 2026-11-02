# WebPraat — Agent Implementation Guide

> **Audience:** AI agents and developers implementing WebPraat.  
> **Repository Root:** `~/dev/webpraat/webpraat/`  
> **Parent Directory:** `~/dev/webpraat/` (contains architecture and planning docs).

---

## 1. Project Overview & Rules

- **Architecture:** Hybrid architecture — C++17 Praat core compiled to WebAssembly via Emscripten (`praatlib.wasm`) + React 19 / TypeScript UI.
- **Location Rule:** All project source files, build scripts, and git history live in `webpraat/` (nested repo). Do **not** place source code or git commits in the parent directory.
- **Parity Rule:** Do **not** rewrite Praat DSP algorithms in TypeScript. Always compile the C++ source in `wasm/praat/` through the C bridge (`wasm/bridge/`).
- **Concurrency Rule:** Never run heavy WASM computation or DSP queries on the UI thread. Always dispatch to the background Web Worker (`src/workers/praatWorker.ts`).

---

## 2. Implementation Order (Phase by Phase)

Agents should work strictly in the following sequence. Do not jump ahead until each phase's acceptance criteria are met.

### Phase 1: WASM Core & C Bridge
1. **Configure CMake:** Complete `wasm/CMakeLists.txt` to compile `melder`, `kar`, headless `sys`, and `fon` with Emscripten.
2. **Implement Bridge (`wasm/bridge/`):**
   - Object table store (`std::unordered_map<int, Thing>`) assigning integer IDs to C++ Praat objects.
   - Core functions: `praat_bridge_init()`, `create_sound()`, `destroy_object()`, `get_object_count()`, `get_object_name()`, `get_object_class()`.
   - Core analysis: `sound_to_pitch()`, `sound_to_formant()`, `sound_to_spectrogram()`.
3. **Build WASM:** Run `pnpm build:wasm` to generate `public/praatlib.wasm` and `public/praatlib.js`.
4. *Acceptance Check:* Node/browser test script can create a Sound, run pitch analysis, and receive matching F0 values.

### Phase 2: Web Worker & Audio I/O
1. **Web Worker (`src/workers/praatWorker.ts`):**
   - Load and instantiate `praatlib.wasm`.
   - Wrap bridge functions in a typed API and expose via `Comlink`.
2. **Audio Decoding & Export (`src/utils/audio.ts`):**
   - Decode WAV/AIFF via native `AudioContext.decodeAudioData`.
   - Decode MP3/FLAC/Vorbis via WASM codecs.
   - Export Sound objects to downloadable 16-bit PCM WAV blobs.
3. *Acceptance Check:* Drag-and-drop audio file into worker successfully registers a `Sound` object and returns duration, sample rate, and channel count.

### Phase 3: Application Shell & Objects List
1. **State Store (`src/store/`):**
   - Define Jotai atoms for object inventory (`PraatObject[]`), selection (`selectedIds`), and active editor tabs.
2. **MenuBar (`src/components/MenuBar/`):**
   - File actions: Open file, Record sound, Save selected.
3. **ObjectsPanel (`src/components/ObjectsPanel/`):**
   - Render list of loaded objects with selection highlights.
   - Implement dynamic action bar (buttons like *View & Edit*, *To Pitch...*, *To Formant...* enabled based on selection).
4. **InfoWindow (`src/components/InfoWindow/`):**
   - Display textual query results (`Get mean`, `Get pitch`, etc.).
5. *Acceptance Check:* User can load a sound, select it, click *To Pitch...*, see `Pitch` object appear in the list, and inspect values in InfoWindow.

### Phase 4: SoundEditor (Waveform & Spectrogram)
1. **Time Axis & Viewport Engine:**
   - Synchronized horizontal zoom/scroll (`[tmin, tmax]`) and selection range.
2. **Waveform Canvas:**
   - Render audio samples within the visible viewport on HTML5 Canvas 2D.
3. **Spectrogram Canvas:**
   - Query time-frequency matrix from WASM for visible range.
   - Render to Canvas via `ImageData` using standard Praat color lookup tables (greyscale/colour).
4. **Analysis Overlays:**
   - Pitch contour (blue path), formant tracks (red dots), intensity (green curve).
5. **Playback Engine (`src/hooks/useAudio.ts`):**
   - Play selected time range using `AudioContext.createBufferSource()`.
   - Real-time animated playhead cursor driven by `requestAnimationFrame`.
6. *Acceptance Check:* Smooth waveform zoom/scroll, correct spectrogram display, and audio playback with synchronous playhead.

### Phase 5: TextGrid Editor & Annotation
1. **TextGrid Data Structures:**
   - Map `IntervalTier` and `TextTier` from WASM to TypeScript interfaces.
2. **TextGridEditor Component (`src/components/TextGridEditor/`):**
   - Render stacked tiers directly beneath the waveform view.
   - Click to add boundaries; drag to move boundaries; double-click/enter to edit text.
   - Support Unicode IPA character input.
3. **File I/O:**
   - Read and write Praat `.TextGrid` text format.
4. *Acceptance Check:* User can annotate an audio file, add/modify boundaries, and export a valid `.TextGrid` file readable by desktop Praat.

### Phase 6: Scripting Console
1. **Script Editor (`src/components/ScriptConsole/`):**
   - Embed CodeMirror 6 with Praat Script syntax highlighting.
2. **Execution Hook:**
   - Pass script string to WASM `praat_bridge_execute_script()`.
   - Intercept `writeInfoLine` outputs into the InfoWindow.
   - Update ObjectsPanel when scripts create/remove objects.
3. *Acceptance Check:* Standard Praat batch scripts run without error and update the UI state.

### Phase 7: Microphone Recording & Advanced Features
1. **Audio Recording:**
   - `AudioWorkletNode` for mic capture into an in-memory buffer.
   - Save captured buffer as new `Sound` object.
2. **PictureWindow (`src/components/PictureWindow/`):**
   - Vector canvas supporting Praat drawing commands; export to PNG/SVG.
3. **Advanced DSP Modules:**
   - Enable `dwtools` (CPP, KlattGrid), `LPC`, `artsynth` as needed.
4. **Workspace Persistence:**
   - Cache loaded objects to Origin Private File System (OPFS) across reloads.

### Phase 8: Advanced TextGrid Annotation & Editor Menus
1. **Editor Menu Bar (`src/components/TextGridEditor/`):**
   - Implement dedicated top menu bar: **File / TextGrid**, **Edit**, **Query**, **Select**, **Interval**, **Boundary**, **Tier**.
   - Mirror standard desktop Praat TextGrid editor menu items, shortcuts, and modal dialogs.
2. **Interval Operations:**
   - `Interval > New interval on tier...`: Insert boundaries at start and end of current time selection (`[tmin, tmax]`) on the active or specified tier.
   - `Interval > Remove interval`: Remove interval boundaries and merge into adjacent interval.
   - `Interval > Set interval text...`: Direct label dialog.
3. **Boundary Operations & Interactive Cursor Buttons:**
   - `Boundary > Add boundary at cursor on tier...` (shortcut: `Enter`).
   - `Boundary > Add boundary on all tiers` (shortcut: `Cmd/Ctrl+Enter`).
   - `Boundary > Remove boundary at cursor` (shortcut: `Alt+Backspace`).
   - `Boundary > Move boundary to cursor`.
   - Render Praat's iconic interactive boundary circle buttons on the cursor line across tiers.
4. **Tier Management:**
   - `Tier > Add interval tier...` & `Tier > Add point tier...`: Specify position index and tier name.
   - `Tier > Remove tier`: Delete selected tier with confirmation dialog.
   - `Tier > Rename tier...` & `Tier > Duplicate tier...`.
5. **WASM Bridge & Data Synchronization:**
   - Implement C bridge functions for tier manipulation (`praat_bridge_textgrid_add_tier`, `praat_bridge_textgrid_remove_tier`, `praat_bridge_textgrid_duplicate_tier`).
   - Integrate seamlessly with the existing snapshot-based Undo/Redo history stack and OPFS persistence.
6. **Localization & Testing:**
   - Add all menu, dialog, and action strings to `en.ts` and `ko.ts` maintaining 100% key parity.
7. *Acceptance Check:* User can select an audio time range, click `Interval > New interval on tier...` (or press `Enter` / click the cursor circle) to create new intervals, add/remove/rename tiers, and export the resulting `.TextGrid` file with identical structure in desktop Praat.

### Phase 9: Interactive Scripting, Form/Pause Dialogs & Local Directory Mounting
1. **Script `form ... endform` Parser & Dynamic Input Modal:**
   - Implement C bridge `praat_bridge_parse_script_form()` invoking `Interpreter_readParameters` to extract form title, comments, and typed parameter definitions (`word`, `sentence`, `text`, `infile`, `outfile`, `folder`, `real`, `positive`, `integer`, `natural`, `boolean`, `choice`/`optionmenu`).
   - Build a dynamic React `ScriptFormModal` (`src/components/ScriptConsole/`) that prompts the user before script execution (including folder/file picker triggers for `folder`/`infile` fields) and injects submitted values into the `Interpreter` (`Interpreter_getArgumentsFromString` / `parameterToVariable`) so lowercase form variables (e.g., `wav_folder$`, `skip_done`) bind identically to desktop Praat.
2. **Local Directory Access & Virtual Filesystem Mounting (`FS` + File System Access API):**
   - Add a **Mount Local Folder...** workflow in `ScriptConsole` and `MenuBar` using the browser File System Access API (`window.showDirectoryPicker({ mode: 'readwrite' })`), with `<input type="file" webkitdirectory>` read-only fallback for non-Chromium browsers.
   - Mirror granted directory trees into Emscripten's virtual filesystem (`Module.FS`, e.g., `/workspace/<folderName>`) and set the Praat current/script working directory (`Melder_setCurrentFolder` / `defaultDirectory$`) so `Create Strings as file list`, `fileReadable()`, and `Read from file` resolve relative and mounted paths natively.
   - Implement two-way write-back so saving an edited `.TextGrid` (`Ctrl/Cmd+S` or `File > Save TextGrid`) updates both `Module.FS` (immediately visible to subsequent script iterations) and the underlying host OS file via `FileSystemFileHandle.createWritable()`.
3. **Headless Praat Command & File-Recognizer Registration (`wasm/bridge/`):**
   - Register headless-safe `fon` script commands and file recognizers during `praat_bridge_init()`: `Data_recognizeFileType(soundFileRecognizer)` (so `Read from file:` loads `.wav`/`.flac`/`.mp3`/`.aiff`), `Create Strings as file list...` / `Create Strings as folder list...`, and `TextGrid` / `Sound` query and modification actions (`Get number of tiers`, `Get number of intervals...`, `Get label of interval...`, etc.).
   - Unify `theCurrentPraatObjects` with `praat_bridge`'s object registry so objects created or removed inside Praat scripts (`Read from file:`, `selectObject:`, `Remove`) stay synchronized with integer IDs used by the Objects list and editors.
4. **Script-Triggered Editor Actions (`Edit` / `View & Edit`) & Quick Save:**
   - Register headless action handlers for `Edit` / `View & Edit` on `Sound`, `TextGrid`, and `Sound + TextGrid` selections that emit structured editor-open events from the worker to the UI, automatically opening `SoundEditor` or `TextGridEditor` with the selected objects.
   - Bind `Ctrl/Cmd+S` in `TextGridEditor` to save the active `TextGrid` directly back to its mounted VFS + host OS path (with toast/status confirmation).
5. **Non-Blocking `beginPause` / `endPause` & `pause` Coroutine Execution:**
   - Hook `UiPause_begin` / `UiPause_end` (`UiPause.cpp`) and `pauseScript` (`praat_script.cpp`) into Praat's `InterpreterStack::haltAll()` and `resumeFromTop()` suspension mechanism instead of failing or returning `0` in batch mode.
   - Return a `"PAUSED"` state with pause form metadata (title, comments, input fields, button labels, default/cancel indices) from the Web Worker so the worker thread stays unblocked for audio playback, spectrogram rendering, and TextGrid editing while paused.
   - Render a floating, non-modal **Script Pause Window** over the workspace (e.g., `[Stop]` / `[Next]`) and resume or abort execution via `praat_bridge_resume_script()` / `praat_bridge_abort_script()`.
6. **Localization & Testing:**
   - Add all script form, pause window, and directory mounting strings to `en.ts` and `ko.ts` with 100% key parity, plus unit/integration tests covering `form` variable binding, VFS directory mounting, `Edit` dispatch, and `beginPause`/`endPause` loop resumption.
7. *Acceptance Check:* User can mount a local folder containing `.wav` files and a `textgrids/` subfolder, run an interactive batch-annotation script (such as `00_open_for_transcription.praat`), submit the initial `form` dialog, annotate each automatically opened `Sound + TextGrid` pair in `TextGridEditor`, save in place with `Ctrl/Cmd+S`, step through files via the floating `[Next]` / `[Stop]` pause window, and re-run with `skip_done` accurately skipping already-labeled TextGrids.

---

## 3. Build Instructions

### Prerequisites
- **Node.js:** `v20+`
- **Package Manager:** `pnpm` (`v9+`)
- **Emscripten SDK (emsdk):** `3.1+` (with `emcc` in `PATH`)
- **CMake:** `3.22+`

### Step 1: Install Frontend Dependencies
```bash
cd ~/dev/webpraat/webpraat
pnpm install
```

### Step 2: Compile WASM Core
Ensure Emscripten is activated in your environment:
```bash
# If using emsdk:
source /path/to/emsdk/emsdk_env.sh

# Run WASM build script:
cd ~/dev/webpraat/webpraat
pnpm build:wasm
# Or for debug symbols:
pnpm build:wasm:debug
```
*Outputs:* `public/praatlib.wasm` and `public/praatlib.js`.

### Step 3: Run Development Server
```bash
cd ~/dev/webpraat/webpraat
pnpm dev
```
Open `http://localhost:5173`. Vite is pre-configured with required COOP/COEP headers.

### Step 4: Verification & Linting
```bash
pnpm typecheck   # TypeScript validation
pnpm lint        # ESLint
pnpm test        # Vitest unit tests
```

### Step 5: Production Bundle
```bash
pnpm build
```
*Output:* Production-ready static files in `dist/`.

---

## 4. Deployment Instructions

### Deployment Requirements
WebPraat relies on `SharedArrayBuffer` for Web Worker threading and AudioWorklet performance. Hosting environments **must** return the following HTTP response headers:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Hosting Target Configs

#### 1. Cloudflare Pages
Add a `_headers` file in `public/`:
```text
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

#### 2. Vercel
Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

#### 3. Nginx
Add to server block:
```nginx
location / {
    root /path/to/dist;
    try_files $uri $uri/ /index.html;
    add_header Cross-Origin-Opener-Policy "same-origin";
    add_header Cross-Origin-Embedder-Policy "require-corp";
}
```

#### 4. GitHub Pages / Static Hosting Fallback
If the host does not support custom headers, install and register `coi-serviceworker` in `index.html` to inject cross-origin isolation headers via a Service Worker on initial load.
