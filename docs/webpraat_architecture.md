# WebPraat Technical Architecture

> **Document Version:** 1.0.0  
> **Target System:** WebPraat (Browser-native web port of Praat)  
> **Source Base:** Upstream Praat (C++17 / C99) + Modern Web Architecture (TypeScript / React 19 / WebAssembly)  

---

## Table of Contents

1. [Architectural Overview & Principles](#1-architectural-overview--principles)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Submodules Breakdown](#3-submodules-breakdown)
   - 3.1 [Frontend Architecture (`src/`)](#31-frontend-architecture-src)
   - 3.2 [WASM Bridge & Core Engine (`wasm/`)](#32-wasm-bridge--core-engine-wasm)
   - 3.3 [Upstream C++ Modules Ported to WASM](#33-upstream-c-modules-ported-to-wasm)
4. [External Dependencies](#4-external-dependencies)
   - 4.1 [Web / Frontend Dependencies](#41-web--frontend-dependencies)
   - 4.2 [WASM Core Vendored Dependencies](#42-wasm-core-vendored-dependencies)
   - 4.3 [Target Browser Web Platform APIs](#43-target-browser-web-platform-apis)
5. [Core Workflow Pipelines](#5-core-workflow-pipelines)
   - 5.1 [Pipeline 1: Audio Ingestion & Format Decoding](#51-pipeline-1-audio-ingestion--format-decoding)
   - 5.2 [Pipeline 2: Phonetic Analysis & Object Generation](#52-pipeline-2-phonetic-analysis--object-generation)
   - 5.3 [Pipeline 3: Time-Domain Visualization & Rendering](#53-pipeline-3-time-domain-visualization--rendering)
   - 5.4 [Pipeline 4: Audio Playback & Real-Time Cursor Animation](#54-pipeline-4-audio-playback--real-time-cursor-animation)
   - 5.5 [Pipeline 5: Microphone Audio Recording](#55-pipeline-5-microphone-audio-recording)
   - 5.6 [Pipeline 6: Praat Script Execution & Automation](#56-pipeline-6-praat-script-execution--automation)
   - 5.7 [Pipeline 7: TextGrid Annotation & Tier Editing](#57-pipeline-7-textgrid-annotation--tier-editing)
   - 5.8 [Pipeline 8: Serialization, File Export & Persistence](#58-pipeline-8-serialization-file-export--persistence)
6. [Memory Management & Interop Model](#6-memory-management--interop-model)
7. [Security, Concurrency & Sandboxing Model](#7-security-concurrency--sandboxing-model)

---

## 1. Architectural Overview & Principles

WebPraat is a complete web-native port of **Praat: doing phonetics by computer**, designed to run fully client-side inside standard web browsers.

### Core Architectural Decisions

1. **Decoupled Computation and Presentation Layers:**  
   Upstream Praat combines numerical DSP routines with a desktop GUI abstraction layer (`sys/Gui*.cpp`, `sys/motifEmulator.cpp`, GTK3/Cocoa/Win32). WebPraat completely **strips out the native GUI abstraction**, retaining the entire computational scientific core compiled into WebAssembly (`praatlib.wasm`), and pairs it with a modern, reactive TypeScript/React user interface.

2. **Zero Mathematical Compromise (Algorithmic Parity):**  
   All DSP algorithms—including Burg formant tracking, Boersma's autocorrelation and cross-correlation pitch analysis, dynamic time warping, cepstral analysis (CPP), Klatt synthesis, PSOLA manipulation, and OT grammar learners—are executed directly from Praat's proven C++ source code via WASM. This ensures byte-level and float-level consistency with published scientific phonetic research.

3. **Client-Side Autonomy & Zero-Cloud Privacy:**  
   All audio processing, feature extraction, file reading/writing, and script execution happen locally inside the user's browser sandbox. No user audio or annotation data is transmitted to an external server.

4. **Non-Blocking Multithreaded Execution:**  
   The UI thread is strictly reserved for user interaction and Canvas rendering. All WASM computation, DSP extraction, and script parsing run inside a dedicated **Web Worker**, communicating via an asynchronous typed RPC bridge (`Comlink`).

---

## 2. End-to-End System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   WEB BROWSER TAB                                      │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        MAIN UI THREAD (React 19 + TypeScript)                    │  │
│  │                                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ MenuBar (File / Edit / Query / Help / Actions)                              │  │  │
│  │  ├──────────────────────────────┬─────────────────────────────────────────────┤  │  │
│  │  │ ObjectsPanel                 │ Editor Workspace (Tabs)                     │  │  │
│  │  │ - Objects List (Sound, etc.) │ - SoundEditor (Waveform + Spectrogram)      │  │  │
│  │  │ - Selection Management       │ - TextGridEditor (Multi-tier annotations)   │  │  │
│  │  │ - Contextual Action Buttons  │ - PictureWindow (Vector graphics canvas)    │  │  │
│  │  ├──────────────────────────────┴─────────────────────────────────────────────┤  │  │
│  │  │ Console / Bottom Panel (ScriptConsole [CodeMirror 6] + InfoWindow text)   │  │  │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │  │
│  │               │                                          │                       │  │
│  │               ▼                                          ▼                       │  │
│  │      ┌──────────────────┐                     ┌─────────────────────┐            │  │
│  │      │ Reactive Store   │                     │ Web Audio Engine    │            │  │
│  │      │ (Jotai / State)  │                     │ (AudioContext +     │            │  │
│  │      └──────────────────┘                     │  AudioWorklet)      │            │  │
│  └───────────────┬──────────────────────────────────────────┬───────────────────────┘  │
│                  │                                          │                          │
│     postMessage  │ (Asynchronous RPC / Comlink)             │ AudioBuffer              │
│                  ▼                                          ▼                          │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                        BACKGROUND WEB WORKER (`praatWorker.ts`)                  │  │
│  │                                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ WASM JS Glue & Typed Wrapper (`PraatWorkerBridge`)                         │  │  │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                       │                                          │  │
│  │                                       ▼                                          │  │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │ `praatlib.wasm` (Emscripten WebAssembly Engine)                            │  │  │
│  │  │                                                                            │  │  │
│  │  │  ┌──────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐  │  │  │
│  │  │  │ C Export Bridge      │  │ Object Table Store  │  │ Script Engine     │  │  │  │
│  │  │  │ (`praat_bridge.cpp`) │  │ (Thing / Daata IDs) │  │ (Interpreter.cpp) │  │  │  │
│  │  │  └──────────────────────┘  └─────────────────────┘  └───────────────────┘  │  │  │
│  │  │  ┌──────────────────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │ Phonetic Core (`fon`, `dwtools`, `LPC`, `stat`, `artsynth`, `gram`)  │  │  │  │
│  │  │  └──────────────────────────────────────────────────────────────────────┘  │  │  │
│  │  │  ┌──────────────────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │ Foundation & Math (`sys`, `melder`, `dwsys`, `kar`)                  │  │  │  │
│  │  │  └──────────────────────────────────────────────────────────────────────┘  │  │  │
│  │  │  ┌──────────────────────────────────────────────────────────────────────┐  │  │  │
│  │  │  │ Vendored DSP/Codecs (`gsl`, `clapack`, `flac`, `vorbis`, `zlib`, …)  │  │  │  │
│  │  │  └──────────────────────────────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                          │                                             │
│                                          ▼                                             │
│                     ┌────────────────────────────────────────┐                         │
│                     │ Browser Storage (OPFS / IndexedDB)     │                         │
│                     └────────────────────────────────────────┘                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Submodules Breakdown

The codebase is organized into two primary segments: the web application frontend (`src/`) and the WebAssembly C++ engine (`wasm/`).

```
webpraat/
├── webpraat/                      # Git repository root
│   ├── src/                       # TypeScript / React application
│   │   ├── components/            # UI components and viewports
│   │   ├── hooks/                 # Custom React hooks (audio, worker, canvas)
│   │   ├── store/                 # Global reactive state (Jotai)
│   │   ├── types/                 # Shared domain interfaces & types
│   │   ├── utils/                 # Audio, color palette, rendering math
│   │   ├── workers/               # Web Worker and Comlink bridge wrappers
│   │   ├── App.tsx                # Main application frame
│   │   └── main.tsx               # Browser entry point
│   │
│   ├── wasm/                      # C++ WASM compilation root
│   │   ├── bridge/                # C bridge exports & handle registry
│   │   │   ├── praat_bridge.h     # C-callable function declarations
│   │   │   └── praat_bridge.cpp   # Wrapper linking C functions to Praat classes
│   │   ├── praat/                 # Core upstream Praat source modules
│   │   │   ├── melder/            # Memory, strings, basic math, vectors
│   │   │   ├── sys/               # Object model, serialization, scripting
│   │   │   ├── kar/               # Unicode and character tables
│   │   │   ├── fon/               # Acoustic and phonetic DSP objects
│   │   │   ├── dwsys/             # Linear algebra, SVD, FFT tables
│   │   │   ├── dwtools/           # Advanced acoustic analysis, Klatt, CPP
│   │   │   ├── LPC/               # Linear Predictive Coding & formants
│   │   │   ├── stat/              # Tables, probability distributions
│   │   │   ├── artsynth/          # Articulatory vocal tract synthesizer
│   │   │   ├── gram/              # Optimality Theory and network grammars
│   │   │   ├── FFNet/             # Feed-Forward Neural Networks
│   │   │   ├── EEG/               # Electroencephalography / ERP tiers
│   │   │   ├── sensors/           # EMA and Electroglottography
│   │   │   └── external/          # Vendored C numerical/codec libraries
│   │   ├── build/                 # Emscripten build artifacts
│   │   ├── scripts/               # Compilation scripts (build.sh)
│   │   └── CMakeLists.txt         # CMake build configuration for Emscripten
│   │
│   ├── public/                    # Static assets, wasm binaries, fonts
│   ├── package.json               # Node.js project configuration
│   ├── vite.config.ts             # Vite bundler configuration (WASM + COOP/COEP)
│   ├── tsconfig.json              # TypeScript compilation configuration
│   └── .gitignore                 # Version control exclusions
│
├── praat_architecture.md          # Upstream Praat reference architecture
├── webpraat_plan.md               # Porting roadmap and strategy plan
└── webpraat_architecture.md       # This document (WebPraat architecture)
```

---

### 3.1 Frontend Architecture (`src/`)

| Module | Location | Purpose & Implementation |
|---|---|---|
| **ObjectsPanel** | `src/components/ObjectsPanel/` | Renders the Praat Objects window. Displays an ordered list of loaded objects (`Sound`, `Pitch`, `TextGrid`, `Spectrogram`, etc.). Calculates which action buttons are active based on the type and quantity of currently selected objects using the dynamic command registry. |
| **MenuBar** | `src/components/MenuBar/` | Global menu bar: **Praat** (preferences, about), **New** (record sound, synthesize sound), **Open** (read from file), **Save** (export selected objects), and **Help** (manual). |
| **SoundEditor** | `src/components/SoundEditor/` | High-performance interactive waveform and spectrogram viewer. Implements horizontal time zoom/scroll, time selection bounds, real-time playhead tracking, and overlays for pitch tracks, formant dots, intensity curves, and glottal pulses. |
| **TextGridEditor** | `src/components/TextGridEditor/` | Synchronized acoustic display + interval/point annotation tiers. Users click to insert or move boundaries, type phonetic labels, and split intervals. Fully synchronizes zoom/scroll with the waveform. |
| **PictureWindow** | `src/components/PictureWindow/` | Vector-drawing canvas reproducing Praat's publication-ready Picture window. Executes Praat drawing instructions (`Draw...`, `Paint spectrogram...`, etc.) and exports to SVG, PNG, or vector PDF. |
| **ScriptConsole** | `src/components/ScriptConsole/` | Code editor built with **CodeMirror 6**, customized with a Praat Script grammar highlighter. Features Run, Clear, and Line Jump capabilities with error messaging. |
| **InfoWindow** | `src/components/InfoWindow/` | Textual output console showing measurements, statistical queries (`Get mean...`, `Get standard deviation...`), and script outputs. |
| **Store** | `src/store/` | Lightweight reactive state management (using **Jotai**). Stores object lists, selections, viewport ranges, audio devices, and user preferences. |
| **Workers** | `src/workers/` | `praatWorker.ts`: Dedicated Web Worker thread that instantiates Emscripten `praatlib.wasm` and hosts the `Comlink` RPC endpoint. |
| **Audio Engine** | `src/utils/audio.ts` & `src/hooks/useAudio.ts` | Handles Web Audio API `AudioContext`, `AudioBuffer` streaming, and `AudioWorklet` real-time microphone acquisition. |

---

### 3.2 WASM Bridge & Core Engine (`wasm/`)

The WASM bridge serves as an interface layer between JavaScript and Praat's internal C++ classes:

- **Handle-Based Object Store:**  
  JavaScript receives opaque integer IDs (`PraatId`) representing C++ objects in WASM memory (`praat_bridge_create_sound` returns an integer ID; subsequent calls like `praat_bridge_sound_to_pitch(soundId, ...)` use this ID).
- **C-Linkage Exports (`extern "C"`):**  
  Functions in `wasm/bridge/praat_bridge.h` provide clean ABI boundaries easily callable by Emscripten's `cwrap` / `ccall`.
- **String & Buffer Marshaling:**  
  Converts JavaScript strings (UTF-8) to Praat's internal `char32_t*` (Unicode code points) and manages zero-copy memory views via `Float32Array` / `Float64Array`.

---

### 3.3 Upstream C++ Modules Ported to WASM

All non-GUI modules from Praat are compiled into WebAssembly:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              praatlib.wasm                             │
├────────────────────────────────────────────────────────────────────────┤
│  Domain Modules:                                                       │
│  - fon: Sound, Spectrogram, Pitch, Formant, Intensity, PointProcess    │
│  - dwtools: Cepstrogram, CPP, KlattGrid, FormantPath, DTW, Procrustes   │
│  - LPC: Autocorrelation, LPC coefficients, MFCC, LFCC, LSF             │
│  - stat: Table, TableOfReal, Distributions, Logistic Regression        │
│  - artsynth: Maeda vocal tract physical synthesizer                    │
│  - gram: Optimality Theory learners (GLA, RIP), Network models         │
│  - FFNet: Feed-forward neural networks                                 │
│  - EEG & sensors: ERP processing, EMA sensor trajectory data           │
├────────────────────────────────────────────────────────────────────────┤
│  Framework Modules:                                                    │
│  - sys (headless): Thing, Daata, Collection, Formula, Interpreter      │
│  - melder: MelderAlloc, MelderString, MelderTensor, NUMmath            │
│  - dwsys: SVD, Eigensystems, NUMFourier FFT tables, Polynomials        │
│  - kar: Unicode tables, longchar encoding mappings                     │
├────────────────────────────────────────────────────────────────────────┤
│  Vendored External DSP & Codecs:                                       │
│  - clapack, gsl, glpk, flac, vorbis, mp3, opusfile, zlib, blake3       │
│  - (Optional on-demand: espeak-ng, whispercpp)                         │
└────────────────────────────────────────────────────────────────────────┘
```

*Note:* `foned` (interactive desktop editors) and `sys/Gui*.cpp` (widget wrappers) are intentionally excluded and replaced by the TypeScript/React frontend.

---

## 4. External Dependencies

### 4.1 Web / Frontend Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` / `react-dom` | `^19.0.0` | Core UI component lifecycle and declarative view rendering |
| `typescript` | `^5.5.3` | Type-safe development across UI, Workers, and WASM types |
| `vite` | `^5.4.2` | Fast HMR dev server and production asset bundler |
| `vite-plugin-wasm` | `^3.3.0` | Enables direct ES module imports of WebAssembly modules |
| `vite-plugin-top-level-await` | `^1.4.4` | Allows top-level await syntax in WebAssembly initialization |
| `@tailwindcss/vite` / `tailwindcss` | `^4.0.0` | Modern utility-first CSS styling |
| `jotai` | `^2.8.3` | Atomic, fine-grained state management (Objects list, active selection) |
| `comlink` | `^4.4.1` | Transparent, type-safe RPC communication across Web Workers |
| `@codemirror/view` / `@codemirror/state` | `^6.0.0` | Code editor core for the Praat Script console |
| `vitest` | `^2.0.5` | Fast unit test runner for frontend logic and numeric parity checks |

---

### 4.2 WASM Core Vendored Dependencies

All libraries reside in `wasm/praat/external/` and are built directly into the WASM bundle:

| Library | Directory | Role in WebPraat |
|---|---|---|
| **CLAPACK** | `external/clapack` | Numerical linear algebra (SVD, matrix inversion, eigenvalues) |
| **GSL (subset)** | `external/gsl` | Mathematical and statistical special functions, integration |
| **GLPK (subset)** | `external/glpk` | Linear programming solver for constraint optimization |
| **FLAC** | `external/flac` | Native decoding and encoding of lossless FLAC audio files |
| **libvorbis** | `external/vorbis` | Ogg Vorbis decoding and encoding |
| **minimp3** | `external/mp3` | Lightweight MP3 audio decoding |
| **libopusfile** | `external/opusfile` | Opus compressed speech decoding |
| **zlib** | `external/zlib` | Deflate compression for binary serialization (`.Collection`, etc.) |
| **BLAKE3** | `external/blake3` | Cryptographic hashing for file integrity and deduplication |
| **num** | `external/num` | High-precision numerical constants and machine parameters |
| **eSpeak-NG** *(lazy)* | `external/espeak` | Multilingual text-to-speech synthesis (loaded on demand) |
| **whisper.cpp** *(lazy)*| `external/whispercpp` | Automated speech recognition & alignment (loaded on demand) |

---

### 4.3 Target Browser Web Platform APIs

| Browser API | Usage in WebPraat | Fallback / Policy |
|---|---|---|
| **WebAssembly (MVP + SIMD + Threads)** | Execution of Praat's C++ DSP algorithms at near-native speed | Baseline WebAssembly 1.0 supported; SIMD128 optional acceleration |
| **Web Audio API (`AudioContext`)** | Audio playback, panning, and sample rate conversion | Standard Web Audio API across all modern desktop/mobile browsers |
| **AudioWorklet & MediaStream** | Low-latency, glitch-free microphone recording | Fallback to standard ScriptProcessor if AudioWorklet unavailable |
| **Canvas 2D Context (`OffscreenCanvas`)** | Real-time waveform, spectrogram rendering, and playhead animations | Main-thread HTMLCanvasElement if OffscreenCanvas not supported |
| **Origin Private File System (OPFS)** | Persistent local workspace storage for large audio sessions | IndexedDB storage fallback |
| **File System Access API** | Direct "Open File..." and "Save As..." native OS dialogs | Standard HTML `<input type="file">` and Blob download triggers |
| **SharedArrayBuffer + Atomics** | High-performance zero-copy audio ring buffers and thread synchronization | Requires COOP/COEP headers enabled in Vite and production hosting |

---

## 5. Core Workflow Pipelines

### 5.1 Pipeline 1: Audio Ingestion & Format Decoding

```
[User drags .wav / .mp3 / .flac into browser]
                       │
                       ▼
            HTML5 Drag & Drop API
                       │
                       ▼
             ArrayBuffer in JS Thread
                       │
                       ▼ postMessage (Transferable)
             Web Worker (`praatWorker.ts`)
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
Standard formats (WAV/AIFF)    Compressed formats (FLAC/Vorbis/MP3)
Native Web Audio               WASM Codec in `praatlib.wasm`
AudioContext.decodeAudioData() (libflac / minimp3 / opusfile)
        │                             │
        └──────────────┬──────────────┘
                       ▼
              PCM Float64 Samples
                       │
                       ▼
       `praat_bridge_create_sound()`
                       │
                       ▼
         C++ `Sound` object instantiated
         Assigned unique integer handle: `id = 1`
                       │
                       ▼
Worker notifies UI: `{ type: "OBJECT_ADDED", id: 1, class: "Sound", name: "hello" }`
                       │
                       ▼
ObjectsPanel updates state via Jotai store -> Rendered in Objects List
```

---

### 5.2 Pipeline 2: Phonetic Analysis & Object Generation

```
[User selects Sound object in ObjectsPanel and clicks "To Pitch..."]
                                │
                                ▼
         React modal prompts for analysis parameters:
         - Time step (s): 0.0 (auto)
         - Pitch floor (Hz): 75.0
         - Pitch ceiling (Hz): 600.0
                                │
                                ▼ [User confirms]
             `praatWorker.executeAction("Sound_to_Pitch", { ... })`
                                │
                                ▼ (Web Worker)
       `praat_bridge_sound_to_pitch(soundId, timeStep, floor, ceiling)`
                                │
                                ▼
       Calls upstream C++ `Sound_to_Pitch()` (Boersma autocorrelation)
       Creates new C++ `Pitch` object in memory
       Registered with new integer handle: `pitchId = 2`
                                │
                                ▼
       Worker emits: `{ id: 2, class: "Pitch", name: "hello" }`
                                │
                                ▼
       ObjectsPanel displays new object: `2. Pitch hello`
```

---

### 5.3 Pipeline 3: Time-Domain Visualization & Rendering

```
[SoundEditor tab opens with viewport: tmin = 0.5s, tmax = 1.2s]
                               │
                               ▼
        Request visible slice from Worker via RPC:
        `getAudioVisualizationData(soundId, tmin, tmax, canvasWidth)`
                               │
                               ▼ (Web Worker)
       Slice PCM samples downsampled to viewport horizontal resolution
       Calculate spectrogram slice (FFT power matrix) if enabled
                               │
                               ▼ Transferable TypedArray
                 Returned to UI Render Loop
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     Waveform Canvas                      Spectrogram Canvas
  Canvas 2D Path Stroking              ImageData Pixel Array Mapping
  Plots amplitude (-1.0 to +1.0)       Look-up Table (LUT) to Color Palette
            │                                     │
            └──────────────────┬──────────────────┘
                               ▼
     Overlaid Vector Graphics (Pitch curve, Formant dots, Intensity)
```

---

### 5.4 Pipeline 4: Audio Playback & Real-Time Cursor Animation

```
[User presses Tab / Spacebar or clicks Selection Playback Bar]
                               │
                               ▼
        Retrieve Float32 PCM buffer for selected interval [t1, t2]
                               │
                               ▼
         Web Audio API: `AudioBufferSourceNode.start()`
         Record start wall-clock time: `startTime = audioContext.currentTime`
                               │
                               ▼
                `requestAnimationFrame` Render Loop:
                ┌──────────────────────────────────────┐
                │ elapsed = audioContext.currentTime   │
                │ currentT = t1 + elapsed              │
                │ Draw red vertical cursor line at     │
                │ x = timeToCanvasX(currentT)          │
                └──────────────────────────────────────┘
                               │
                               ▼
          Audio finishes -> Source node `onended` fires
          Cursor line disappears; playback state resets
```

---

### 5.5 Pipeline 5: Microphone Audio Recording

```
[User opens "New -> Record Sound..." modal and clicks "Record"]
                               │
                               ▼
         `navigator.mediaDevices.getUserMedia({ audio: true })`
                               │
                               ▼
                 `MediaStreamAudioSourceNode`
                               │
                               ▼
           `AudioWorkletNode` (`PraatRecordProcessor`)
           Captures raw Float32 samples from audio thread
                               │
                               ▼
       Continuous chunk streaming via `MessagePort` to Worker
       Appended to growing dynamically allocated buffer in WASM
                               │
                        [User clicks "Stop"]
                               │
                               ▼
           Calls `praat_bridge_create_sound()` in WASM
           New Sound object appears in ObjectsPanel
```

---

### 5.6 Pipeline 6: Praat Script Execution & Automation

```
[User pastes Praat Script into ScriptConsole and clicks "Run"]
                               │
                               ▼
                   Script text sent to Worker
                               │
                               ▼
            `praat_bridge_execute_script(scriptText)`
                               │
                               ▼
      Invokes upstream `praat_executeScriptFromText()`
      inside `wasm/praat/sys/praat_script.cpp`:
      - Lexical analysis & tokenization (`Interpreter.cpp`)
      - Mathematical formula evaluation (`Formula.cpp`)
      - Variable stack maintenance (numbers, strings, arrays)
      - Dynamic command execution (`praat_executeCommand()`)
                               │
                               ▼
      - All `writeInfoLine` / `appendInfoLine` intercepted into buffer
      - Generated objects automatically added to object registry
                               │
                               ▼
       Worker returns `{ logOutput: string, createdObjectIds: number[] }`
                               │
                               ▼
      InfoWindow displays textual log; ObjectsPanel updates entries
```

---

### 5.7 Pipeline 7: TextGrid Annotation & Tier Editing

```
[User selects Sound + TextGrid and clicks "View & Edit"]
                               │
                               ▼
       TextGridEditor loads synchronized views:
       - Top: Acoustic waveform + spectrogram
       - Bottom: Stacked IntervalTiers and TextTiers
                               │
                               ▼
[User clicks in an IntervalTier at time t = 0.85s to add boundary]
                               │
                               ▼
       Worker: `IntervalTier_addBoundary(tierId, 0.85)`
       Sorts intervals and updates boundary list
                               │
                               ▼
[User types label: "aa" and presses Enter]
                               │
                               ▼
       Worker: `TextInterval_setText(intervalId, "aa")`
                               │
                               ▼
       Editor canvas immediately redraws boundary and IPA text label
```

---

### 5.8 Pipeline 8: Serialization, File Export & Persistence

```
[User selects objects and clicks "Save -> Save as WAV..." / "Save as TextGrid..."]
                               │
                               ▼
       Worker calls `Data_writeToTextFile()` / `Sound_writeToAudioFile()`
       Writes into Emscripten virtual in-memory file (`/tmp/export.ext`)
                               │
                               ▼
       File buffer read into Uint8Array via Emscripten `FS.readFile()`
                               │
                               ▼
       Transferred to UI thread as an ArrayBuffer
                               │
                               ▼
       Created as `Blob([buffer], { type: mimeType })`
                               │
        ┌──────────────────────┴──────────────────────┐
        ▼                                             ▼
File System Access API                         Anchor Download Fallback
`window.showSaveFilePicker()`                  `<a download="file.wav">`
Saves directly to user-chosen path             Triggers standard browser download
```

---

## 6. Memory Management & Interop Model

Because WebAssembly and JavaScript have separate memory models, WebPraat follows strict lifecycle boundaries:

1. **Opaque ID Registry:**  
   JavaScript never receives raw C++ memory pointers. The bridge layer (`praat_bridge.cpp`) maintains an internal ID map (`std::unordered_map<int, Thing>`). JavaScript receives integer IDs, preventing dangling pointer bugs or invalid memory access.
2. **Deterministic Destruction:**  
   When a user clicks "Remove" on an object in the Objects list, an explicit call to `praat_bridge_destroy_object(id)` is sent to the WASM worker, releasing C++ memory via Praat's `forget()` / `Melder_free()`.
3. **Zero-Copy Views:**  
   Large numerical datasets (such as 10-minute audio sound arrays or spectrogram frequency bins) are passed across the Web Worker boundary using **Transferable Objects** (`postMessage(data, [data.buffer])`), avoiding double-allocation overhead.
4. **WASM Heap Sizing:**  
   The WebAssembly memory heap starts at **64 MB** and uses Emscripten's `-s ALLOW_MEMORY_GROWTH=1` flag to dynamically expand on demand up to the browser-enforced limit (~2 GB on 32-bit WASM).

---

## 7. Security, Concurrency & Sandboxing Model

| Vector | Upstream Native Praat | WebPraat Implementation |
|---|---|---|
| **File System Access** | Arbitrary read/write access to user's entire local hard drive | **Sandboxed:** Restricted strictly to explicit user-selected files or private OPFS storage |
| **Network & Telemetry**| Minimal network access for manual downloads | **Strict Air-Gap:** 100% client-side; zero external telemetry or cloud computation |
| **Malicious Scripts**  | Unsandboxed; shell commands can be executed via system calls | `praat_executeCommand()` disables system calls; runs in worker sandbox |
| **Cross-Origin Security**| OS-level desktop process | Protected by standard browser Same-Origin Policy and COOP/COEP headers |
| **Crash Resilience**   | Fatal crash terminates application and loses unsaved work | WASM crash in Web Worker does not crash the browser tab; worker can safely restart |

---

*WebPraat Architecture Specification — Prepared for WebPraat Development (November 2026).*
