# WebPraat
---
This is a web port of [Praat](https://www.fon.hum.uva.nl/praat/) based on the original repository's commit `f9409a4d59c9bd99967ce36273ca87a64b4c2be3`.

The code in this project was created with AI assistance. As I've made this port out of personal need, not all parts of it are human-tested. Feel free to contact me via Discord @ dawnradiance if you have any suggestions or questions related to WebPraat.

The following is an agent-generated overview and build instructions of the project.

## Overview

WebPraat brings desktop Praat’s phonetic analysis, speech synthesis, and annotation capabilities directly to modern web browsers without requiring backend computation.

### Core Philosophy: True Algorithmic Parity
Rather than re-implementing complex signal processing algorithms in JavaScript or TypeScript, WebPraat directly compiles the original, battle-tested C++ source code from Praat (`melder`, `kar`, headless `sys`, `fon`, `dwtools`, `LPC`, `artsynth`, `stat`) into WebAssembly (`praatlib.wasm`). Acoustic analyses—such as Burg formant tracking, acoustic autocorrelation pitch analysis, and Cepstral Peak Prominence (CPP)—produce numerical results that match desktop Praat bit-for-bit.

---

## Key Features

- **Phonetic Analysis & DSP**:
  - **Pitch (F0)**: Robust autocorrelation and cross-correlation pitch tracking.
  - **Formants**: Burg algorithm linear predictive formant tracking with customizable bandwidths, maximum formants, and ceiling frequencies.
  - **Spectrogram**: Dynamic time-frequency matrix calculation with standard Praat colour and greyscale colour maps.
  - **Intensity**: Acoustic intensity contour extraction.
  - **Advanced Modules**: Cepstral Peak Prominence (CPP / PowerCepstrogram), LPC Burg analysis, KlattGrid vowel/speech synthesis, and Articulatory Synthesis (Artword + Speaker).
- **Interactive Editors**:
  - **SoundEditor**: Synchronized multi-layered canvas displaying waveform, spectrogram, pitch contour (blue), formant tracks (red), and intensity (green), with smooth viewport zoom/scroll and real-time audio playback.
  - **TextGridEditor**: Multi-tier annotation interface (interval tiers and point tiers) with interactive boundary creation/splitting, tier management, Unicode IPA character palette, and native `.TextGrid` file import/export.
  - **PictureWindow**: Vector-based graphics canvas supporting Praat drawing commands (inner boxes, marks, circles, text labels) and vector SVG / raster PNG export.
  - **ScriptConsole**: In-browser Praat Script execution engine with CodeMirror 6 syntax highlighting, standard batch scripting support, and Info window interception.
- **Microphone Recording**:
  - In-browser mono and stereo recording powered by `AudioWorkletNode`, capturing live audio into high-precision floating-point buffers and converting them directly into Praat `Sound` objects.
- **Client-Side Persistence & Performance**:
  - Non-blocking execution using Web Workers (`praatWorker.ts`) via Comlink RPC.
  - Origin Private File System (OPFS) workspace persistence to retain loaded objects and scripts across browser sessions.
- **Bilingual Interface**:
  - Full UI localization in English and Korean (한국어) with real-time dynamic switching.

---

## Project Structure

```text
webpraat/
├── docs/                             # Architecture and planning documentation
│   ├── praat_architecture.md         # Desktop Praat C++ source structure & DSP module analysis
│   ├── webpraat_architecture.md     # WebPraat hybrid system architecture specification
│   ├── webpraat_plan.md             # 8-phase implementation roadmap and test criteria
│   └── agents.md                     # Development rules, acceptance checks & coding guide
├── public/                           # Static assets & precompiled binaries
│   ├── praatlib.wasm                 # Compiled Praat C++ WebAssembly module (~7.8 MB)
│   ├── praatlib.js                   # Emscripten JavaScript runtime glue
│   ├── recorder-worklet.js           # AudioWorklet processor for microphone capture
│   └── coi-serviceworker.js          # Cross-Origin Isolation Service Worker for GitHub Pages
├── src/                              # React 19 / TypeScript frontend application
│   ├── components/                   # UI components
│   │   ├── InfoWindow/               # Query output and diagnostic display
│   │   ├── MenuBar/                  # Top application menu bar (Praat, New, Open, Save, Help)
│   │   ├── ObjectsPanel/             # Object list and selection-driven dynamic action bar
│   │   ├── PictureWindow/            # Vector graphics canvas & drawing tools
│   │   ├── ScriptConsole/            # Praat Script editor & execution environment
│   │   ├── SoundEditor/              # Waveform & spectrogram multi-layer canvas viewer
│   │   ├── SoundRecorder/            # Microphone recording dialog
│   │   ├── TextGridEditor/           # TextGrid annotation viewer, menus, and tier dialogs
│   │   └── shared/                   # Common dialogs, modals, and buttons
│   ├── config/locales/               # Bilingual localization dictionaries (en.ts, ko.ts)
│   ├── hooks/                        # Custom React hooks (audio playback, viewport, undo/redo)
│   ├── store/                        # Jotai state management atoms (objects, tabs, selection)
│   ├── utils/                        # Audio codecs, WAV encoder/decoder, OPFS persistence, TextGrid I/O
│   └── workers/                      # Background Web Worker (praatWorker.ts) and Comlink interface
├── wasm/                             # C++ Praat source and Emscripten C bridge
│   ├── bridge/                       # C bridge exposing Praat C++ APIs via integer object handles
│   │   ├── praat_bridge.h            # C bridge header
│   │   ├── praat_bridge.cpp          # Bridge implementation (Sound, Pitch, Formant, TextGrid, LPC, etc.)
│   │   └── praat_bridge_script.cpp   # Praat script execution engine bridge
│   ├── praat/                        # Upstream Praat C++ source code (fon, dwtools, LPC, artsynth, sys, etc.)
│   ├── CMakeLists.txt                # CMake build definition for Emscripten
│   └── scripts/build.sh              # WASM compilation automation script
├── index.html                        # Application entry point
├── package.json                      # Dependencies and npm scripts
├── tsconfig.json                     # TypeScript configuration
└── vite.config.ts                    # Vite build configuration (Tailwind, WASM, COOP/COEP headers)
```

---

## Dependencies & Prerequisites

### Frontend & Runtime
- **Node.js**: `v20.0.0+`
- **Package Manager**: `pnpm` (`v9.0.0+`)
- **Core Libraries**:
  - [React 19](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/)
  - [Vite 5](https://vitejs.dev/) + [@tailwindcss/vite](https://tailwindcss.com/) (Tailwind CSS v4)
  - [Jotai](https://jotai.org/) (atomic state management)
  - [Comlink](https://github.com/GoogleChromeLabs/comlink) (Web Worker RPC)
  - [CodeMirror 6](https://codemirror.net/) (script editing)
  - [Vitest](https://vitest.dev/) (unit and integration testing)

### WASM Compilation (Optional)
> *Note:* Pre-compiled `praatlib.wasm` and `praatlib.js` are already included in `public/`. You only need these prerequisites if modifying C++ source code in `wasm/`:
- **Emscripten SDK (`emsdk`)**: `3.1+` (with `emcc` in `PATH`)
- **CMake**: `3.22+`
- **Make** or **Ninja**

---

## Build & Development Instructions

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Development Server
```bash
pnpm dev
```
Open `http://localhost:5173`. Vite is pre-configured with the required `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers.

### 3. Verification & Testing
```bash
pnpm typecheck   # Validate TypeScript types without emit
pnpm test        # Run Vitest test suite across all phases (65+ tests)
```

### 4. Production Build
```bash
pnpm build
```
Generates static assets in `dist/`.

### 5. Compiling WebAssembly (C++ Core)
If you modify files in `wasm/bridge/` or `wasm/praat/`:
```bash
# Ensure Emscripten environment is activated:
source /path/to/emsdk/emsdk_env.sh

# Build release WASM binary:
pnpm build:wasm

# Or build with debug symbols:
pnpm build:wasm:debug
```
Outputs are written directly to `public/praatlib.wasm` and `public/praatlib.js`.

---

## Deployment & Hosting

WebPraat relies on `SharedArrayBuffer` for Web Worker threading and AudioWorklet performance. Hosting environments must support Cross-Origin Isolation:

- **Vercel / Netlify / Cloudflare Pages / Nginx**: Set HTTP response headers:
  ```http
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```
- **GitHub Pages**:
  GitHub Pages does not support custom HTTP response headers. WebPraat includes `coi-serviceworker.js` in `public/` and registers it in `index.html` to automatically inject the required isolation headers client-side. The automated deployment workflow is configured in `.github/workflows/deploy.yml`.

---

## Documentation

For comprehensive technical details, consult the documents in the [`docs/`](./docs/) directory:
- [**Desktop Praat Architecture (`docs/praat_architecture.md`)**](./docs/praat_architecture.md): Analysis of desktop Praat's internal C++ module graph, data types (`Thing`, `Data`, `Function`, `Sampled`), and execution pipeline.
- [**WebPraat System Architecture (`docs/webpraat_architecture.md`)**](./docs/webpraat_architecture.md): Technical specification of the WASM compilation strategy, C bridge memory model, Web Worker architecture, AudioWorklet pipeline, and canvas rendering engine.
- [**Development Plan & Phases (`docs/webpraat_plan.md`)**](./docs/webpraat_plan.md): Historical milestone roadmap from Phase 1 (Core WASM) through Phase 8 (TextGrid operations & menus).
- [**Agent Implementation Guide (`docs/agents.md`)**](./docs/agents.md): Implementation rules, architectural constraints, test commands, and coding standards.

---

## Credits & License

- **Original Praat Software**:
  - Developed by **Paul Boersma** and **David Weenink** at the Department of Phonetic Sciences, University of Amsterdam.
  - Official website: [https://www.fon.hum.uva.nl/praat/](https://www.fon.hum.uva.nl/praat/)
  - Original Praat source code is licensed under the **GNU General Public License (GPL v3.0 or later)**.
- **WebPraat**:
  - Web port architecture, C bridge, Web Worker integration, and React 19 interface created by [**gggentooo**](https://github.com/gggentooo) and contributors.
  - Distributed under the **WebPraat Non-Commercial & Attribution License** (see [LICENSE](./LICENSE)):
    1. **Free Use**: Freely usable and modifiable for personal, academic, scientific, and educational non-commercial purposes.
    2. **Mandatory Attribution**: Redistribution of code, forks, or derivative works is permitted but requires preserving copyright notices and prominently crediting the original repository ([`gggentooo/webpraat`](https://github.com/gggentooo/webpraat)) and original Praat authors.
    3. **Non-Commercial Restriction**: Generating revenue, selling, charging fees, or monetizing repository code, compiled WebAssembly binaries, or built/hosted applications is strictly prohibited without prior written permission.
