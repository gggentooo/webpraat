# WebPraat – Web Port Development Plan
---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Porting Strategy Options](#2-porting-strategy-options)
3. [Recommended Approach](#3-recommended-approach)
4. [Technology Stack](#4-technology-stack)
5. [Architecture Design](#5-architecture-design)
6. [Module-by-Module Porting Notes](#6-module-by-module-porting-notes)
7. [Audio I/O in the Browser](#7-audio-io-in-the-browser)
8. [Graphics & Rendering](#8-graphics--rendering)
9. [Scripting Engine](#9-scripting-engine)
10. [File I/O & Persistence](#10-file-io--persistence)
11. [UI Design Notes](#11-ui-design-notes)
12. [Phased Roadmap](#12-phased-roadmap)
13. [Key Challenges & Mitigations](#13-key-challenges--mitigations)
14. [What Should NOT Be Ported](#14-what-should-not-be-ported)
15. [Open Questions](#15-open-questions)

---

## 1. Executive Summary

Praat's C++ codebase is ~300,000 lines and includes its own GUI toolkit abstraction, graphics engine, scripting language, and dozens of DSP/statistical algorithms. Porting it faithfully to the web is a significant but achievable effort using a combination of:

- **Emscripten (WebAssembly)** to compile the C++17 core directly, preserving all existing algorithms
- **A modern TypeScript/React frontend** that replaces the native GUI abstraction layer
- **Web Audio API** for real-time audio playback and recording
- **Canvas 2D / WebGL** for rendering waveforms and spectrograms

The port will be split into two layers: a **WASM core** (the compiled Praat C++ computation engine exposed as a library) and a **web frontend** (a completely new UI written in TypeScript).

---

## 2. Porting Strategy Options

### Option A: Pure Emscripten port (compile everything to WASM)

Compile all of Praat to WebAssembly, including its GUI layer (replacing GTK/Cocoa/Win32 with Emscripten's SDL2 or HTML canvas bindings).

| Pros | Cons |
|---|---|
| Maximum algorithm fidelity (zero reimplementation) | Praat's GUI code is deeply entangled with native APIs (GTK3, Cocoa, Win32 Motif emulator); adapting all of it to Emscripten is very hard | 
| Scripting engine comes for free | Canvas-emulated GUI will look dated and feel unresponsive |
| Near-instant algorithmic coverage | File I/O, threading, and audio require significant Emscripten shim work |

**Verdict:** Viable as a headless core, but not as a complete solution.

### Option B: Full TypeScript reimplementation

Rewrite all algorithms in TypeScript/JavaScript.

| Pros | Cons |
|---|---|
| Modern, maintainable codebase | Enormous effort: ~300,000 lines of highly optimized numeric C++ |
| Native web performance for UI | Risk of algorithmic bugs and subtle numeric differences |
| Easy to integrate with web tooling | Long time-to-feature parity |

**Verdict:** Only viable for a small subset (e.g. just spectrogram display). Not suitable for a full port.

### Option C: Hybrid — WASM core + TypeScript/React UI (RECOMMENDED)

Compile only the **computation-layer** C++ modules to WebAssembly (using a `praatlib`-style build), and write an entirely new web frontend that communicates with the WASM core through a clean JavaScript API.

| Pros | Cons |
|---|---|
| All algorithms preserved exactly | Requires designing a JS↔WASM bridge API |
| Modern web UI (React, Tailwind, etc.) | Emscripten toolchain has a learning curve |
| Clear separation of concerns | Some modules (articulatory synth, whisper.cpp) may be heavy for WASM |
| Scripting engine comes for free from WASM | Need to intercept Praat's "Info window" and "Objects list" output |

**Verdict:** This is the right approach.

---

## 3. Recommended Approach

### Core principle: WASM library + modern frontend

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                 │
│                                                          │
│  ┌──────────────────────┐   ┌────────────────────────┐  │
│  │  React / TypeScript  │   │  Web Workers           │  │
│  │  UI Layer            │◄──┤  (WASM execution)      │  │
│  │                      │   │                        │  │
│  │  - Objects Panel     │   │  praatlib.wasm:         │  │
│  │  - Editor windows    │   │  melder + sys + fon +   │  │
│  │  - Picture canvas    │   │  dwtools + LPC + …      │  │
│  │  - Script editor     │   │                        │  │
│  └──────────────────────┘   └────────────────────────┘  │
│            │                          │                  │
│  ┌─────────▼──────────────────────────▼───────────────┐  │
│  │  Web Audio API    │  IndexedDB / OPFS  │  Canvas   │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

The WASM module is compiled from Praat's C++ with:
- GUI layer (`sys/Gui`, `motifEmulator`, GTK3) **stripped out** — replaced by a JavaScript callback interface
- Audio (`melder_audio`, PortAudio) **replaced** by Web Audio API interop
- All computation modules (`fon`, `dwtools`, `LPC`, `gram`, `stat`, etc.) **kept intact**

---

## 4. Technology Stack

### Computation Core (WASM)

| Component | Technology | Notes |
|---|---|---|
| Compiler | **Emscripten 3.x** | Compiles C++17 to WebAssembly |
| Target | **WASM + JS glue** | `SIDE_MODULE=0`, exported C API |
| Threading | **SharedArrayBuffer + Atomics** (Emscripten pthreads) | For PortAudio replacement and heavy analysis |
| Memory | **64 MB–256 MB initial WASM heap** | Configurable; most sounds fit in 64 MB |
| Build | **CMake + Emscripten toolchain file** | Or adapt the existing Makefile with `emcc` |

### Frontend

| Component | Technology | Notes |
|---|---|---|
| UI framework | **React 19 + TypeScript** | Component-based; good ecosystem for panels/tabs |
| Styling | **Tailwind CSS v4** | Utility-first; fast iteration |
| State management | **Zustand** or **Jotai** | Lightweight; avoids Redux boilerplate for object list |
| Build tool | **Vite** | Fast HMR; WASM plugin support via `vite-plugin-wasm` |
| Package manager | **pnpm** | Efficient monorepo support |

### Graphics / Rendering

| Component | Technology | Notes |
|---|---|---|
| Waveform / spectrogram display | **Canvas 2D API** (OffscreenCanvas in worker) | High-performance 2D rendering |
| Spectrogram colour mapping | Custom JS shader or `ImageData` writes | WebGL for very large spectrograms |
| Picture window | **Canvas 2D** with SVG export option | Mirror the Praat Graphics abstraction in JS |
| Text in graphics | **Canvas 2D `fillText`** + custom IPA font | Load Praat's IPA font as a web font |

### Audio

| Component | Technology | Notes |
|---|---|---|
| Playback | **Web Audio API `AudioBuffer`** | Low latency; supports multichannel |
| Recording | **MediaStream API + `AudioWorklet`** | Replaces PortAudio |
| File decoding | **Web Audio `decodeAudioData`** for common formats; supplemented by **WASM FLAC/Vorbis** for exotic formats | |
| Real-time cursor | **`AudioContext.currentTime`** for playback position | |

### Storage

| Component | Technology | Notes |
|---|---|---|
| Session objects | **Zustand in-memory store** | Mirrors Praat's Objects list |
| File persistence | **Origin Private File System (OPFS)** | Persistent workspace between sessions |
| Large files | **OPFS + ReadableStream** | Replaces `LongSound` streaming |
| Export | **File System Access API** (`showSaveFilePicker`) or download blobs | |

---

## 5. Architecture Design

### WASM Bridge API (C exports)

The WASM module exposes a C API (extern "C") that the JavaScript frontend calls:

```c
// Object management
int   praat_createSound(double* samples, int n, int channels, double fs);
void  praat_destroyObject(int id);
int   praat_getObjectCount();
const char* praat_getObjectName(int id);
const char* praat_getObjectClass(int id);

// Analysis (example)
int   praat_soundToPitch(int soundId, double timestep, double minPitch, double maxPitch);
int   praat_soundToFormant(int soundId, double timestep, int nFormants, double maxFormant, double windowLength);
int   praat_soundToSpectrogram(int soundId, double windowLength, double maxFreq, double timestep, double windowShape);

// Data retrieval
double  praat_pitchGetMean(int pitchId, double tmin, double tmax);
double* praat_spectrogramGetMatrix(int spectroId, int* nrows, int* ncols);

// Scripting
const char* praat_executeScript(const char* scriptText);

// Info window output
const char* praat_getInfoOutput();
```

All heavy computation runs in a **Web Worker** to keep the UI thread responsive. Calls are made asynchronously via `postMessage` / `Comlink`.

### Frontend State Model

The frontend's state mirrors Praat's Objects window:

```typescript
interface PraatObject {
  id: number;
  className: string;    // "Sound", "Pitch", "TextGrid", …
  name: string;
  selected: boolean;
}

interface AppState {
  objects: PraatObject[];
  selectedIds: number[];
  infoOutput: string;
  openEditors: EditorWindow[];
}
```

### Editor windows

Each editor window is a React component that:
1. Receives a `PraatObject` (or pair of objects, e.g. Sound + TextGrid)
2. Queries the WASM core for display data (samples, spectrogram matrix, pitch values, tier data)
3. Renders onto a `<canvas>` using Canvas 2D API
4. Sends user interactions (clicks, drags, key presses) back to the WASM core where needed

---

## 6. Module-by-Module Porting Notes

### `melder` (Foundation)

- **Keep as-is in WASM.** All string handling, math utilities, file abstraction, progress reporting.
- Replace `melder_audio` PortAudio calls with JS callbacks (the WASM module calls a JS function via Emscripten's `EM_ASM` / `emscripten_run_script`, or better, via function pointer injection).
- `MelderFile` works fine in WASM when backed by OPFS via Emscripten's FS layer.

### `sys` (Framework)

- **Strip the GUI half entirely** (`Gui*.cpp`, `motifEmulator.cpp`, `Editor.cpp`, `Ui.cpp`) — these are replaced by React components.
- **Keep the non-GUI half:** `Thing`, `Data`, `Collection`, `Formula`, `Interpreter`, `praat_actions`, `Manual`, `Preferences`.
- `Graphics` — keep the abstract base class and the PostScript backend (useful for Picture export). Replace `GraphicsScreen` with a JS bridge that transmits drawing commands to a Canvas 2D context.

### `kar` (Unicode)

- Keep entirely in WASM. The longchar encoding is needed for the scripting engine and for graphics text.
- The IPA font should also be loaded as a web font (`@font-face`) for the Canvas text renderer.

### `fon` (Phonetics — core DSP)

- **Keep entirely in WASM.** This is the heart of Praat; all algorithms are preserved.
- `Sound_audio.cpp` — replace `MelderAudio_play16` with a JS callback that feeds an `AudioBuffer`.
- `LongSound` — map to OPFS streaming reads (Emscripten's FS with OPFS backend).
- Audio file format decoders (FLAC, Vorbis, MP3, Opus) stay in WASM as-is.

### `foned` (Interactive Editors)

- **Do not port to WASM.** Replace entirely with React editor components.
- The React `SoundEditor` component queries WASM for spectrogram matrix, pitch values, formant values, and renders them on Canvas.
- The React `TextGridEditor` queries WASM for tier/interval data and renders them.

### `dwsys`, `dwtools`, `LPC`, `stat`

- **Keep in WASM.** All computation is preserved.
- Objects created in these modules are managed by the WASM object store; JS queries them by ID.

### `gram` (OT Grammar)

- Keep in WASM. Expose learning algorithms via C API.

### `artsynth` (Articulatory Synthesis)

- Keep in WASM. This is CPU-intensive; it benefits from WASM's near-native speed.
- However, consider making it optional (lazy-loaded WASM module) to reduce initial bundle size.

### `FFNet`

- Keep in WASM.
- Consider whether to supplement with WebNN or ONNX Runtime Web for more modern ML use cases.

### `EEG`, `sensors`

- Keep in WASM.

### `external/whispercpp`

- Keep in WASM. whisper.cpp already has a WebAssembly port (`whisper.wasm`). Use that as a reference or directly use the existing port.
- This is the heaviest module (~50 MB model weights); load on-demand only.

### `external/espeak`

- Keep in WASM. eSpeak-NG already runs in WASM (used by Praat's `SpeechSynthesizer`).
- Data files embedded via `FileInMemory` work fine in WASM.

---

## 7. Audio I/O in the Browser

### Playback

```
WASM: Sound_playPart()
  └─ calls JS callback with: int16 buffer, sampleRate, nChannels
        │
        ▼
  Web Audio API:
    AudioContext.createBuffer(nChannels, nFrames, sampleRate)
    AudioBufferSourceNode.start()
    AudioContext.currentTime → polling for cursor position
```

For very long sounds (LongSound), implement streaming by requesting chunks from WASM at the end of each buffer's playback.

### Recording

```
navigator.mediaDevices.getUserMedia({audio: true})
  └─ MediaStreamAudioSourceNode
       └─ AudioWorkletNode (ring buffer → SharedArrayBuffer)
            └─ SharedArrayBuffer → WASM memory (via Atomics)
                 └─ WASM: builds Sound object
                      └─ JS: displays in SoundRecorder UI
```

The recording chain requires `SharedArrayBuffer` (which requires COOP/COEP headers, enforced via server config or service worker).

### Playback cursor

Use `AudioContext.currentTime` and `AudioBufferSourceNode.onended` to animate a time cursor over the waveform canvas.

---

## 8. Graphics & Rendering

### Waveform display

- Draw directly onto a `<canvas>` element using Canvas 2D API.
- For long sounds, render only the visible time window; re-render on scroll/zoom.
- Use `requestAnimationFrame` for smooth updates.
- Run rendering in `OffscreenCanvas` transferred to a Web Worker for parallelism.

### Spectrogram display

- Request spectrogram matrix from WASM (a `Float64Array`) for the current view window.
- Map power values to a colour gradient (e.g. Praat's default grey/blue/magenta palette) using a precomputed lookup table written into an `ImageData` pixel array.
- Use `createImageBitmap` for efficient GPU-backed transfer to the canvas.
- For very large spectrograms (>4K columns), consider a WebGL shader for colour mapping.

### Pitch contour, formant dots, intensity curve

- Drawn as Canvas 2D vector paths overlaid on the waveform/spectrogram canvas.
- Query WASM for pitch/formant/intensity values per visible frame via the WASM bridge API.

### Picture window

- Implement a JavaScript version of Praat's `Graphics` abstraction.
- Each drawing command (`line`, `text`, `fillRectangle`, etc.) maps to a Canvas 2D or SVG call.
- The Picture window renders to a high-DPI canvas; export as PNG, SVG, or PDF.
- For SVG export, build an SVG DOM in memory during rendering.

### IPA and special character rendering

- Load Praat's IPA font (DejaVu/Charis/Doulos) as a `@font-face` web font.
- Implement the `longchar` escape sequence renderer (`\pi`, `\ss{R}`, etc.) in TypeScript by translating to Unicode code points before rendering with `canvas.fillText`.

---

## 9. Scripting Engine

The Praat Script interpreter lives in `sys/Interpreter.cpp` and `sys/Formula.cpp` — both are compiled into the WASM core and work as-is.

### Browser integration

The script editor is a React component (using **CodeMirror 6** with a custom Praat Script language mode for syntax highlighting and basic autocompletion).

When the user clicks "Run":
1. Script text is passed to the WASM module via `praat_executeScript(text)`.
2. The WASM interpreter runs, dispatching menu commands against the current object list.
3. Any `writeInfo` / `appendInfo` calls are intercepted and returned as a string.
4. Object list changes (new objects created, objects removed) are reflected back to the JS state.
5. Any GUI commands (`View & Edit`, `To Pitch…` dialogs) need to be bridged: the WASM core triggers a JS callback that opens the corresponding React component.

### Handling dialog boxes from script

In the native app, `Ui.cpp` creates dialog boxes when a command needs parameters. In the web port:
- If a command is called from script **with arguments** (the common scripted case), it runs headlessly in WASM.
- If called from the Objects window menus (interactive), the React frontend shows a modal dialog, collects parameters, and calls the WASM function directly.

### Demo window

Praat's `DemoEditor` (used for interactive presentations/experiments) can be implemented as a full-screen Canvas-based overlay in the web UI.

---

## 10. File I/O & Persistence

### Audio file input

1. User selects file via `<input type="file">` or drag-drop.
2. The `File` object is read as an `ArrayBuffer` in JS.
3. For common formats (WAV, AIFF): use `AudioContext.decodeAudioData`.
4. For FLAC, Vorbis, Opus, MP3: pass the `ArrayBuffer` to the WASM decoder (Praat's own decoders, already compiled in).
5. The decoded PCM is written into a WASM-allocated `Sound` object.

### Audio file output

1. The WASM Sound object's PCM is read back to JS as a `Float32Array`.
2. For WAV: encode in JS using a simple WAV writer or the Web Audio API's future `AudioEncoder`.
3. For FLAC, Vorbis: use WASM encoders.
4. Trigger browser download via `URL.createObjectURL(blob)`.

### Praat object file I/O

- `.TextGrid`, `.Pitch`, `.Formant`, etc. (Praat's native text format) — pass through WASM's existing `Data_readFromTextFile` / `Data_writeToTextFile`.
- Map file reads to OPFS file handles or in-memory buffers via Emscripten's FS layer.

### Workspace persistence (OPFS)

- The Origin Private File System (OPFS) provides a persistent, sandboxed filesystem that can hold loaded objects between sessions.
- Emscripten can be configured to use OPFS as its filesystem backend (`FS.mount(IDBFS, ...)` or the newer OPFS shim).
- Implement a "Save workspace" / "Load workspace" feature that serializes the entire object list to OPFS.

---

## 11. UI Design Notes

### Layout

```
┌────────────────────────────────────────────────┐
│  Menu bar: Praat | New | Open | Save | Help    │
├──────────────┬─────────────────────────────────┤
│  Objects     │  Editor / Picture area           │
│  panel       │  (tabbed document interface)     │
│              │                                  │
│  ┌────────┐  │  ┌──────────────────────────┐   │
│  │ Sound  │  │  │  SoundEditor             │   │
│  │ hello  │  │  │  ┌─────────────────────┐ │   │
│  │────────│  │  │  │ waveform + pitch +   │ │   │
│  │ Pitch  │  │  │  │ spectrogram          │ │   │
│  │ hello  │  │  │  └─────────────────────┘ │   │
│  └────────┘  │  │  ▶ 0.00 ─────────── 3.45 │   │
│              │  └──────────────────────────┘   │
│  [Actions]   │                                  │
│  View & Edit │                                  │
│  To Pitch... │                                  │
│  To Formant…│                                  │
│  ──────────  │                                  │
│  Save...     │                                  │
├──────────────┴─────────────────────────────────┤
│  Info window / Script console                   │
└────────────────────────────────────────────────┘
```

### Key UI components

| Component | Description |
|---|---|
| **Objects Panel** | Scrollable list of PraatObject cards, multi-selectable. Right panel shows context-sensitive action buttons. |
| **Editor Tabs** | Each `View & Edit` call opens a new tab (or focuses existing). Tabs show editor type + object name. |
| **SoundEditor canvas** | Zoomable, scrollable time-domain view. Top half: waveform + pitch + intensity. Bottom half: spectrogram + formants. Scrollbar at bottom. |
| **TextGridEditor canvas** | Extends SoundEditor with annotation tier panels below; click to create boundaries, double-click to label. |
| **Picture canvas** | Persistent drawing surface; supports Praat graphics commands from scripts. |
| **Script console** | CodeMirror 6 editor with Praat Script syntax highlighting, run button, output panel. |
| **Info window** | Read-only textarea showing numeric output from queries and scripts. |
| **Preference dialogs** | Modal dialogs mirroring Praat's analysis parameter dialogs (spectrogram settings, pitch settings, etc.). |

### Responsive design

- The app is primarily designed for desktop browsers (a 13"+ screen), matching Praat's original desktop UX.
- Tablet support (touch gestures for zoom/scroll) is a stretch goal.
- Mobile is not a primary target (too small for detailed spectrogram work).

### Accessibility

- All interactive elements should have ARIA labels.
- Keyboard shortcuts matching Praat's native shortcuts where feasible.
- High-contrast mode support via CSS custom properties.

---

## 12. Phased Roadmap

### Phase 0 — WASM Build Proof-of-Concept (2–4 weeks)

- [ ] Set up Emscripten toolchain targeting `praatlib`-style build (no GUI, no audio I/O)
- [ ] Compile `melder` + `kar` + `sys` (non-GUI parts) + `fon` to WASM
- [ ] Export a minimal C API: `createSound`, `soundToPitch`, `pitchGetMean`
- [ ] Write a trivial HTML test page that loads the WASM, creates a Sound from a sine wave, computes pitch, and logs the result
- [ ] Validate numeric outputs match the native Praat binary

### Phase 1 — Core Analysis Engine (4–6 weeks)

- [ ] Expand the C API to cover: Spectrogram, Formant, Intensity, Pitch, Harmonicity, TextGrid
- [ ] Add audio file decoding: WAV (native Web Audio), FLAC (WASM), MP3/Ogg (WASM)
- [ ] Add audio file encoding: WAV output
- [ ] Build the Web Worker wrapper (`praatWorker.ts`) with async messaging (`Comlink`)
- [ ] Unit-test all analysis outputs against reference values from native Praat

### Phase 2 — Objects UI & Basic Editors (6–8 weeks)

- [ ] React app skeleton: Objects panel, Info window, menu bar
- [ ] SoundEditor canvas: waveform rendering, zoom/scroll, playback (Web Audio)
- [ ] Spectrogram overlay on SoundEditor
- [ ] Pitch contour overlay
- [ ] Formant dots overlay
- [ ] Basic recording via MediaStream + AudioWorklet
- [ ] Action menus: To Pitch, To Formant, To Spectrogram; results appear in Objects list

### Phase 3 — TextGrid Editor & Annotation (4–6 weeks)

- [ ] TextGrid creation and display in TextGridEditor
- [ ] Interval tier editing (click to add/move boundaries, label intervals)
- [ ] Point tier editing
- [ ] Keyboard navigation in tiers
- [ ] Save/load TextGrid in Praat text format

### Phase 4 — Scripting Console (4–6 weeks)

- [ ] Script editor with CodeMirror 6 + Praat Script syntax highlighting
- [ ] Run scripts in WASM; display Info output
- [ ] Bridge script-invoked dialogs to React modals
- [ ] Run script from file (OPFS or upload)
- [ ] Script error display with line number highlighting

### Phase 5 — Picture Window & Export (3–4 weeks)

- [ ] Picture canvas: implement Praat Graphics command set in JavaScript
- [ ] Expose Picture drawing commands from Praat Script (Draw waveform, Paint spectrogram, etc.)
- [ ] Export: PNG, SVG, PDF (PDF via `jsPDF` or Canvas-to-PDF)

### Phase 6 — Advanced Features (ongoing)

- [ ] LPC module (MFCC, cepstrum, formant path)
- [ ] Manipulation editor (PSOLA resynthesis)
- [ ] KlattGrid synthesis
- [ ] eSpeak-NG text-to-speech
- [ ] Whisper.cpp speech recognition (on-demand load)
- [ ] OT Grammar editor
- [ ] EEG module
- [ ] Statistical analysis (Table, PCA, MDS)
- [ ] Articulatory synthesis
- [ ] OPFS workspace persistence
- [ ] Drag-and-drop file import
- [ ] Keyboard shortcuts matching native Praat

---

## 13. Key Challenges & Mitigations

### Challenge 1: WASM binary size

The full Praat WASM module (with all external libraries compiled in) may exceed 20–30 MB uncompressed.

**Mitigation:**
- Split into a core WASM module (~5–8 MB for melder+fon+sys) and optional feature modules (whisper, artsynth, eSpeak) loaded on demand.
- Enable Brotli compression on the server (WASM compresses extremely well; expect 3–5× size reduction).
- Use `--split-dwarf` in debug builds; strip debug in production.

### Challenge 2: COOP/COEP headers for SharedArrayBuffer

`SharedArrayBuffer` (required for Emscripten pthreads and for the AudioWorklet ring buffer) requires the server to send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. This can break embedding of third-party resources.

**Mitigation:**
- Use a service worker to inject COOP/COEP headers (no server changes needed for static hosting).
- Or avoid pthreads and run single-threaded WASM (slower analysis but simpler deployment). Most Praat analyses are fast enough without threads.

### Challenge 3: Memory limits

Browsers limit WebAssembly memory growth. A 1-hour stereo 48kHz sound at float64 uses ~1.6 GB — far beyond what is practical in WASM.

**Mitigation:**
- Implement `LongSound` streaming: only load the viewed portion into WASM memory.
- Use `Float32` (not float64) internally for display paths to halve memory usage for very long files.
- Set a practical limit (e.g. 60 minutes at 44.1 kHz stereo) and document it.

### Challenge 4: Numeric parity with native Praat

Some analyses may produce slightly different results due to compiler optimizations, floating-point differences between WASM and x86, or platform-specific library versions.

**Mitigation:**
- Run an automated test suite comparing WASM outputs against native Praat reference outputs (using the existing `test/` scripts adapted for the WASM build).
- Pin to the same GSL and CLAPACK sources.

### Challenge 5: Cross-origin audio loading

Web security policies prevent loading audio files from arbitrary URLs without CORS headers.

**Mitigation:**
- Always load audio via user-initiated file picker or drag-drop (no CORS issue).
- For URL loading (a potential feature), proxy through a server-side CORS gateway.

### Challenge 6: GUI command / script bridge

Praat Script can open dialog boxes (`beginPause`/`endPause`), which requires coordinating between the WASM interpreter and the React UI.

**Mitigation:**
- Implement `beginPause`/`endPause` using an async WASM<→Worker<→UI roundtrip: WASM raises a JS event, React renders a modal and awaits user input, the response is sent back to WASM via a SharedArrayBuffer semaphore (Atomics.wait/notify).

---

## 14. What Should NOT Be Ported

The following Praat features have no meaningful equivalent in a browser environment and should be deprioritized or omitted:

| Feature | Reason |
|---|---|
| System audio I/O (ASIO, JACK, CoreAudio raw) | Replaced by Web Audio API; no low-latency driver control |
| PostScript printer output | Use PDF export instead |
| File system path scripting (opening arbitrary paths) | Browser sandboxes prevent arbitrary FS access; use OPFS/upload instead |
| Apple Notarization / Windows code signing | Not applicable to web apps |
| Multiple simultaneous audio output devices | Not supported by Web Audio API |
| Platform-specific font embedding (GDI, Core Text) | Use web fonts instead |

---

## 15. Open Questions

1. **Licensing:** Praat is GPL v3. A web port that distributes the compiled WASM binary must also be GPL v3 or compatible. All frontend code (React, TypeScript) must be compatible. Clarify before using any proprietary fonts or libraries.

2. **whisper.cpp model weights:** The Whisper model files (50 MB – 1.5 GB depending on variant) cannot be bundled; they must be downloaded on demand. Decide on hosting strategy (huggingface.co CDN? self-hosted?).

3. **eSpeak data files:** Currently embedded in the binary via `FileInMemory`. For WASM, these can remain as a bundled data file loaded at startup.

4. **Performance target:** What is the acceptable latency for "To Pitch" on a 10-second sound? Praat native takes ~100 ms. WASM overhead should add <2×. Set measurable acceptance criteria.

5. **Offline use:** Should the app work offline (no network after initial load)? If yes, implement a Service Worker for full PWA support.

6. **Collaboration features:** Should multiple users share a session or annotate the same sound simultaneously? This would require a server-side component (e.g. WebSocket-based sync).

7. **Authentication and file storage:** If files are stored in the cloud (not just OPFS), an authentication system is needed.

---

*Document prepared for the WebPraat project (November 2026), based on source analysis of `~/dev/praat`.*
