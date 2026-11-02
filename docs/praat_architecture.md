# Praat Technical Architecture

> **Source analyzed:** `~/dev/praat` (GitHub mirror, ~2026-05 HEAD)  
> **Language:** C++17 / C99  
> **License:** GNU GPL v3 or later  
> **Authors:** Paul Boersma, David Weenink (University of Amsterdam, Institute of Phonetics Sciences)

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Module Dependency Graph](#2-module-dependency-graph)
3. [Core Modules](#3-core-modules)
   - 3.1 [melder – Foundation Layer](#31-melder--foundation-layer)
   - 3.2 [sys – Framework & GUI Abstraction](#32-sys--framework--gui-abstraction)
   - 3.3 [kar – Character & Unicode](#33-kar--character--unicode)
   - 3.4 [fon – Phonetics Objects](#34-fon--phonetics-objects)
   - 3.5 [foned – Interactive Editors](#35-foned--interactive-editors)
   - 3.6 [dwsys – Data & Numerical Utilities](#36-dwsys--data--numerical-utilities)
   - 3.7 [dwtools – Advanced DSP & Statistics](#37-dwtools--advanced-dsp--statistics)
   - 3.8 [stat – Basic Statistics](#38-stat--basic-statistics)
   - 3.9 [LPC – Linear Predictive Coding](#39-lpc--linear-predictive-coding)
   - 3.10 [gram – Grammar & OT Learning](#310-gram--grammar--ot-learning)
   - 3.11 [artsynth – Articulatory Synthesis](#311-artsynth--articulatory-synthesis)
   - 3.12 [FFNet – Feed-Forward Neural Networks](#312-ffnet--feed-forward-neural-networks)
   - 3.13 [EEG – Electroencephalography](#313-eeg--electroencephalography)
   - 3.14 [sensors – EMA & Electroglottography](#314-sensors--ema--electroglottography)
   - 3.15 [main – Entry Point](#315-main--entry-point)
4. [External Dependencies](#4-external-dependencies)
5. [The Object System (Thing / Daata)](#5-the-object-system-thing--daata)
6. [GUI Abstraction Layer](#6-gui-abstraction-layer)
7. [The Graphics Subsystem](#7-the-graphics-subsystem)
8. [The Scripting Engine](#8-the-scripting-engine)
9. [Audio I/O Pipeline](#9-audio-io-pipeline)
10. [File I/O & Serialization](#10-file-io--serialization)
11. [Key Phonetic Data Types](#11-key-phonetic-data-types)
12. [User-Side Workflow](#12-user-side-workflow)
13. [Build System](#13-build-system)

---

## 1. High-Level Overview

Praat is a desktop GUI application (with a headless "barren" mode) written predominantly in C++17 with small sections of C99. Its architecture is a classic **monolithic layered design** — layers depend only on layers below them, and the entire program is compiled into a single executable (or optionally as a static/dynamic library, `praatlib`).

```
┌────────────────────────────────────────────────────────┐
│  main/            entry point, logo, plugin dispatch   │
├────────────────────────────────────────────────────────┤
│  artsynth  EEG  FFNet  sensors                         │  Domain modules
│  gram  LPC  dwtools  stat                              │  (optional layers)
│  foned                                                 │  Interactive editors
│  fon                                                   │  Phonetic objects & DSP
├────────────────────────────────────────────────────────┤
│  sys                                                   │  Framework (object model,
│  dwsys  kar                                            │  GUI, scripting, graphics)
├────────────────────────────────────────────────────────┤
│  melder                                                │  Foundation (memory,
│                                                        │  strings, audio, I/O)
├────────────────────────────────────────────────────────┤
│  external/  (portaudio, espeak, FLAC, LAME, GSL, …)   │  Vendored third-party libs
└────────────────────────────────────────────────────────┘
```

The application starts in `main/main_Praat.cpp`, calls `praat_init()`, loads the `praat_uvafon_init` library (which registers all phonetics objects and menu commands), then enters the event loop via `praat_run()`.

---

## 2. Module Dependency Graph

```
main
 ├── fon, foned, artsynth, EEG, FFNet, sensors, gram, LPC, dwtools, stat
 └── sys

artsynth → fon
EEG → fon, foned
FFNet → dwsys, stat
sensors → fon
gram → sys, fon
LPC → fon, dwsys
dwtools → fon, dwsys, stat
stat → sys

foned → fon, sys
fon → sys, dwsys, kar, espeak, flac, gsl, whispercpp

sys → melder, kar
dwsys → melder, gsl
kar → melder

melder → portaudio, zlib, blake3
```

---

## 3. Core Modules

### 3.1 `melder` – Foundation Layer

**~31,000 lines**

The lowest-level module; every other module includes `melder.h`. It provides:

| Sub-component | Responsibility |
|---|---|
| `melder_alloc` | Custom allocator (`Melder_calloc`, `Melder_realloc`, `Melder_free`) with OOM handling |
| `melder_tensor` | Generic n-dimensional array types (`VEC`, `MAT`, `STRVEC`, `TENSOR3`, `TENSOR4`) using RAII `auto*` wrappers |
| `melder_str32` | 32-bit Unicode string utilities (Praat uses `char32_t` internally everywhere) |
| `MelderString` | Growable string buffer with `MelderString_append` |
| `MelderFile` | Cross-platform file abstraction (open, path handling, temp files) |
| `MelderReadText` | Streaming UTF-8/UTF-16/Latin-1 text reader |
| `melder_audio` | Platform audio output dispatch: calls `MelderAudio_play16()` which routes to PortAudio |
| `melder_progress` | Progress-bar callbacks (decoupled from GUI) |
| `melder_error` | Exception-via-`MelderError` and error-message accumulation |
| `melder_info` | The Info window output stream |
| `NUMmath`, `NUMrandom`, `NUMear`, `NUMfilter`, `NUMinterpol`, `NUMspecfunc` | Portable numeric utilities (statistics helpers, random number generators, psychoacoustic filters) |
| `MAT` / `VEC` | Vectorised operations on tensors (SIMD-friendly via `PAIRWISE_SUM`) |
| `abcio` | Binary & text I/O primitives (big-endian IEEE 754 r32/r64, etc.) |
| `regularExp` | Built-in POSIX-style regex engine |
| `MelderThread` | POSIX/Win32 threading wrapper |

**Key design choice:** Praat uses `char32_t` (32-bit code points) as its internal string type everywhere, and converts to/from `char` (UTF-8) only at system boundaries. This avoids surrogate-pair complexities on Windows.

---

### 3.2 `sys` – Framework & GUI Abstraction

**~68,500 lines**

The architectural backbone of Praat. Provides the object model, GUI toolkit abstraction, graphics engine, scripting infrastructure, and the top-level application object (`praat`).

Key files:

| File | Role |
|---|---|
| `Thing.h / Thing.cpp` | Root base class. Defines `ClassInfo` (vtable-like metadata), `Thing_define`, `Thing_implement` macros, and `autoThing` RAII smart pointer |
| `Data.h / Data.cpp` | `Daata` (serialisable `Thing`): adds `v1_copy`, `v1_equal`, `v1_writeText`, `v1_readText`, `v1_writeBinary`, `v1_readBinary` virtual methods |
| `Collection.h` | `Ordered<T>`, `SortedSet<T>`, etc. — generic homogeneous typed containers of `autoThing` |
| `oo.h` | The "object-orientation" macro system: `oo_DOUBLE`, `oo_VEC`, `oo_OBJECT`, etc. Used in `_def.h` files to declare struct members, and re-included multiple times with different definitions to auto-generate read/write/copy/equal/describe methods |
| `Graphics.h / Graphics.cpp` | Abstract 2-D graphics context with coordinate transforms, viewports, line/fill/text/image primitives |
| `GraphicsScreen.cpp` | Concrete screen backend: Cairo+Pango (Linux), GDI+/QuartzCore (Windows/Mac) |
| `GraphicsPostscript.cpp` | PostScript export backend |
| `Gui.h` + `Gui*.cpp` | Platform-independent widget wrappers: `GuiButton`, `GuiMenu`, `GuiList`, `GuiText`, `GuiDrawingArea`, etc. These wrap GTK3 on Linux, Win32/Motif emulator on Windows, and Cocoa on macOS |
| `motifEmulator.cpp` | A home-grown Motif API emulator that runs on top of Win32 GDI, allowing the same widget-creation code to work on Windows |
| `Editor.h` | Base class for all document windows; manages menus, drawing area, keyboard/mouse events |
| `Ui.h / Ui.cpp` | Dialog-box infrastructure; connects UI widgets to C++ function callbacks |
| `Formula.h / Formula.cpp` | Stack-based formula evaluator (numbers, strings, vectors, matrices, tensors) |
| `Interpreter.h` | Praat scripting interpreter: variable table, call stack, `@proc`, `for`, `while`, `if` constructs |
| `praat.h / praat.cpp` | Top-level application singleton: object list, selection model, menu-command registry, `praat_addAction1/2/3/4` |
| `praat_actions.cpp` | Dynamic menu system (Object-window actions that depend on current selection) |
| `praat_menuCommands.cpp` | Static application-level menu registration |
| `praat_script.cpp` | Script file execution, `runScript`, `execute` |
| `Manual.h` | Built-in hypertext manual (all help pages are compiled in as C++ functions) |
| `Preferences.h` | Persistent preference system (written to an ini-like file) |

---

### 3.3 `kar` – Character & Unicode

**~3,000 lines**

Provides:
- `longchar.h / longchar.cpp` — Praat's "longchar" encoding: escape sequences like `\pi`, `\ss{R}` for special characters in graphics text, and bidirectional mapping to Unicode
- `UnicodeData.h`, `UCD_features_generated.h` — Compiled-in Unicode character property tables
- `wctype_portable.cpp` — Portable `iswlower`/`iswupper` etc. based on the Unicode tables
- `ipaSerifRegularPS.cpp` — Embedded PostScript IPA font data

---

### 3.4 `fon` – Phonetics Objects

**~85,700 lines** — the core scientific library.

All analysis and synthesis algorithms live here. Objects are classified by what they represent:

#### Time-domain signals

| Class | Inherits | Description |
|---|---|---|
| `Sound` | `Vector` | Sampled audio signal (multichannel, double-precision amplitudes) |
| `LongSound` | `Sampled` | Lazy-loaded large audio file (streams from disk) |
| `Movie` | `Sampled` | Video frames + embedded Sound |

#### Frequency-domain

| Class | Description |
|---|---|
| `Spectrum` | FFT spectrum (complex amplitudes × frequency bins) |
| `Spectrogram` | Time-frequency matrix (short-time Fourier power) |
| `Cochleagram` | Auditory spectrogram (gammatone filterbank) |
| `Ltas` | Long-term average spectrum |

#### Pitch & voice

| Class | Description |
|---|---|
| `Pitch` | Voiced/unvoiced frame pitch (autocorrelation or SHR) |
| `PitchTier` | Interpolatable pitch curve (control points) |
| `Harmonicity` | HNR (harmonic-to-noise ratio) per frame |
| `PointProcess` | Series of time-stamped events (glottal pulses, clicks) |

#### Formants

| Class | Description |
|---|---|
| `Formant` | LPC or Burg formant trajectory (frequencies + bandwidths × time) |
| `FormantTier` | Interpolatable formant curve |
| `FormantGrid` | Formant synthesizer specification |
| `VocalTract` | Tube model of the vocal tract |

#### Intensity

| Class | Description |
|---|---|
| `Intensity` | Time-varying RMS amplitude (dB) |
| `IntensityTier` | Editable intensity curve |
| `AmplitudeTier` | Linear amplitude tier |

#### Annotation

| Class | Description |
|---|---|
| `TextGrid` | Multi-tier annotation: `IntervalTier` (labeled segments) + `TextTier` (labeled time points) |
| `Label` | Legacy annotation (pre-TextGrid) |
| `WordList` | Lexicon object |

#### Manipulation

| Class | Description |
|---|---|
| `Manipulation` | Bundle of Sound + PitchTier + DurationTier for PSOLA-based resynthesis |
| `DurationTier` | Editable time-warping curve |

#### Neural/speech perception

| Class | Description |
|---|---|
| `Excitation` | Auditory excitation pattern |
| `ExperimentMFC` | Minimal Pair / forced-choice perception experiment controller |
| `Corpus` | Dataset of labeled sound files |

#### Supporting types

- `Matrix` — General 2-D real matrix (base for many derived objects)
- `Function` — Abstract time-domain function (base for `Sound`, `Spectrogram`, `Pitch`, etc.)
- `AnyTier` — Abstract tier base (used by `PitchTier`, `IntensityTier`, `TextTier`, etc.)

**Key algorithms** (in `Sound_to_*.cpp`):
- `Sound_to_Pitch` — Autocorrelation pitch tracker (SHR / filtered autocorrelation / raw cross-correlation)
- `Sound_to_Formant` — Burg LPC formant extractor
- `Sound_to_Spectrogram` — Short-time FFT spectrogram
- `Sound_to_Harmonicity` — GNE / CCF harmonicity
- `Sound_to_Intensity` — RMS intensity with smoothing

---

### 3.5 `foned` – Interactive Editors

The set of editor windows (subclasses of `sys/Editor`) that provide the interactive UI for phonetic objects. Each editor contains one or more **Area** objects (a newer architectural split introduced around 2022):

| Editor | Area(s) | Object shown |
|---|---|---|
| `SoundEditor` | `SoundArea`, `SoundAnalysisArea` | Sound / LongSound |
| `TextGridEditor` | `TextGridArea`, `SoundAnalysisArea` | TextGrid + Sound |
| `ManipulationEditor` | `SoundArea`, `PitchArea`, `DurationTierArea` | Manipulation |
| `SpectrumEditor` | `SpectrumArea` | Spectrum |
| `SpectrogramEditor` | `SpectrogramArea` | Spectrogram |
| `PitchEditor` | `PitchArea` | Pitch |
| `FormantGridEditor` | `FormantGridArea` | FormantGrid |
| `IntensityTierEditor`, `DurationTierEditor`, `AmplitudeTierEditor` | `*TierArea` | Tier objects |
| `SoundRecorder` | — | Records microphone input |
| `RunnerMFC` | — | Runs perception experiments |
| `MovieWindow` | `MovieArea` | Movie |

`SoundAnalysisArea` is the key analysis widget: it caches computed `Spectrogram`, `Pitch`, `Intensity`, `Formant`, and `PointProcess` objects in memory for interactive display, recomputing only when view parameters change.

`FunctionEditor` is the abstract base editor for all time-domain editors; it handles the shared time axis, zoom/scroll, playback cursor, and selection.

---

### 3.6 `dwsys` – Data & Numerical Utilities

**~22,000 lines** (David Weenink's system-level extensions)

| Component | Description |
|---|---|
| `SVD`, `Eigen` | Singular value decomposition, eigendecomposition |
| `NMF` | Non-negative matrix factorization |
| `NUMFourier` | FFT engine (real and complex) |
| `Polynomial`, `ChebyshevSeries`, `LegendreSeries`, `Spline` | Function series expansions |
| `Permutation` | Permutation objects and inversion counting |
| `Collection_extensions` | Extra container utilities |
| `DataStore`, `Command` | Generic undo/redo history infrastructure |
| `FileInMemory` | Virtual file system (used to embed espeak data in the binary) |
| `NUMcomplex` | Complex number arithmetic |
| `NUMselect` | Quickselect / median selection |
| `MAT_numerics` | Matrix norms, Procrustes, etc. |

---

### 3.7 `dwtools` – Advanced DSP & Statistics

**~45,000 lines**

A rich collection of advanced analysis objects:

| Object | Description |
|---|---|
| `CC` / `Cepstrum` / `Cepstrogram` / `CPP` | Cepstral analysis, cepstral peak prominence |
| `FormantPath` / `FormantModeler` | Bayesian formant path tracking |
| `ConstantQSpectrograms` | CQT-based spectrogram |
| `DTW` | Dynamic time warping |
| `CCA` | Canonical correlation analysis |
| `MDS` (via `Configuration`, `Dissimilarity`) | Multidimensional scaling |
| `Discriminant` | Linear discriminant analysis |
| `PCA` | Principal component analysis |
| `Correlation`, `Covariance` | Second-order statistics |
| `KlattGrid` | Klatt (1980) formant-cascade synthesizer |
| `SpeechSynthesizer` | Text-to-speech via eSpeak-NG |
| `AnalyticSound` | Analytic signal (Hilbert transform) |
| `Network` | Hopfield/Boltzmann networks (cognitive modelling) |
| `Net`, `Layer` | Deep learning layers (used with FFNet) |
| `NoulliGrid` | Probabilistic annotation grid |
| `ComplexSpectrogram` | Complex-valued spectrogram |

---

### 3.8 `stat` – Basic Statistics

**~8,000 lines**

| Object | Description |
|---|---|
| `Table` | General-purpose data table (like a spreadsheet), the primary data import/export format |
| `TableOfReal` | Numeric matrix with row/column labels |
| `Distributions`, `PairDistribution` | Probability distributions |
| `Regression`, `LogisticRegression` | Regression models |
| `TableEditor` | Interactive spreadsheet editor |

---

### 3.9 `LPC` – Linear Predictive Coding

**~15,000 lines**

| Object | Description |
|---|---|
| `LPC` | LPC coefficients frame object |
| `Cepstrumc` | Cepstral coefficients |
| `MFCC`, `LFCC` | Mel / Linear frequency cepstral coefficients |
| `Autocorrelation` | Time-domain autocorrelation |
| `LineSpectralFrequencies` | LSF representation of LPC |
| `FormantModelerList` | Multi-model formant tracking |

---

### 3.10 `gram` – Grammar & OT Learning

**~12,000 lines**

| Object | Description |
|---|---|
| `OTGrammar` | Optimality Theory grammar with learning algorithms (GLA, RIP) |
| `OTMulti` | Multi-input OT grammar |
| `CubeGrid` / `NoulliGrid` | Probabilistic grammar models |
| `Network` | Spreading-activation network |

---

### 3.11 `artsynth` – Articulatory Synthesis

**~5,000 lines**

Implements the Maeda (1979) / Boersma (1998) articulatory synthesizer:

| Object | Description |
|---|---|
| `Speaker` | Vocal tract anatomical model (glottis, lungs, tubes) |
| `Artword` | Timed articulatory gesture specification |
| `Articulation` | Single articulatory parameter set |
| `Delta` | Differential vocal tract state |

Synthesis is performed by `Artword_Speaker_to_Sound()` which numerically integrates the acoustic tube equations.

---

### 3.12 `FFNet` – Feed-Forward Neural Networks

**~3,000 lines**

A custom implementation of multi-layer perceptrons:
- `FFNet` — Network topology + weights
- `FFNet_PatternList_ActivationList` — Training with backpropagation
- `FFNet_PatternList_Categories` — Classification

---

### 3.13 `EEG` – Electroencephalography

**~4,000 lines**

- `EEG` — Multi-channel EEG recording (sampled signal + channel metadata)
- `ERP` / `ERPTier` — Event-related potentials and time-locked averages
- `EEGWindow`, `ERPWindow` — Interactive waveform editors

---

### 3.14 `sensors` – EMA & Electroglottography

**~2,000 lines**

- `EMA` / `EMArawData` — Electromagnetic articulography (tongue/lip motion data)
- `Electroglottogram` — Glottal contact area waveform

---

### 3.15 `main` – Entry Point

`main/main_Praat.cpp` is a ~100-line file that:
1. Sets the splash logo callback
2. Calls `praat_init()` (parses `argc`/`argv`, sets up the GUI, reads preferences)
3. Calls `INCLUDE_LIBRARY(praat_uvafon_init)` to register all objects and menus
4. Calls `praat_run()` (enters the platform event loop)

The design is intentionally extensible: a third-party application can include a subset of Praat's modules, register only the needed objects, and produce a specialized executable (a documented pattern in `praat.h`).

---

## 4. External Dependencies

All third-party code is **vendored** inside `external/` (no system library required for audio/DSP):

| Library | Directory | Purpose | Notes |
|---|---|---|---|
| **PortAudio** | `external/portaudio` | Cross-platform audio I/O (record + playback) | Supports ALSA, PulseAudio, JACK on Linux; CoreAudio on macOS; WASAPI/MME on Windows |
| **eSpeak-NG** | `external/espeak` | Text-to-speech synthesis | Data files embedded via `FileInMemory` |
| **whisper.cpp** | `external/whispercpp` | OpenAI Whisper speech recognition | Includes Silero VAD for voice activity detection |
| **FLAC** | `external/flac` | FLAC audio encoding/decoding | |
| **libvorbis** | `external/vorbis` | Ogg Vorbis encoding/decoding | |
| **LAME** | `external/lame` | MP3 encoding | |
| **libopusfile** | `external/opusfile` | Opus audio decoding | |
| **minimp3** | `external/mp3` | MP3 decoding | |
| **GSL** (subset) | `external/gsl` | GNU Scientific Library: numerical routines | Only needed files included |
| **CLAPACK** | `external/clapack` | LAPACK routines in C | Eigenvalue decomposition, SVD |
| **GLPK** (subset) | `external/glpk` | GNU Linear Programming Kit | Used by `NUMlinprog` |
| **num** | `external/num` | Custom numerical helpers | |
| **zlib** | `external/zlib` | Deflate compression | Used for binary file format compression |
| **BLAKE3** | `external/blake3` | Cryptographic hash | Used for file integrity checks |

**System GUI libraries** (not vendored — linked from the OS):

| Platform | GUI toolkit | Graphics | Text layout | Audio |
|---|---|---|---|---|
| Linux | GTK 3 | Cairo | Pango | ALSA + PulseAudio + JACK |
| macOS | Cocoa | Quartz / Core Graphics | Core Text | CoreAudio |
| Windows | Win32 (Motif emulator) | GDI+ | Uniscribe | WASAPI / WDM |

---

## 5. The Object System (Thing / Daata)

Praat implements its own C++ object model on top of standard C++ inheritance.

### Class hierarchy (simplified)

```
Thing   (structThing)
 └─ Daata   (serialisable; read/write text & binary)
     └─ Function   (has xmin/xmax domain)
         └─ Sampled   (nx, dx, x1 — uniformly sampled)
             ├─ Matrix   (2D: Sampled × SampledXY)
             │   ├─ Sound   (Vector → Matrix)
             │   ├─ Spectrogram
             │   └─ Pitch
             └─ SampledXY   (two axes)
```

### Registration and introspection

Every class calls `Thing_implement(ClassName, ParentClass, version)` which fills in a static `structClassInfo` record:

```cpp
struct structClassInfo {
    conststring32 className;        // "Sound"
    ClassInfo semanticParent;       // &theClassInfo_Vector
    integer size;                   // sizeof(structSound)
    Thing (*_new)();                // factory function
    integer version;                // file-format version
    integer sequentialUniqueIdOfReadableClass;
    Thing dummyObject;
};
```

`Thing_recognizeClassesByName()` registers a class for serialization; this allows `Data_readFromTextFile()` to instantiate any registered class by name.

### The `oo.h` macro system

`_def.h` files (e.g. `Sound_def.h`) describe struct members using macros like:

```cpp
oo_INT(nx)
oo_DOUBLE(dx)
oo_VEC(z, nx)
```

The same `_def.h` is included multiple times by the build, each time with different macro definitions drawn from `oo_COPY.h`, `oo_EQUAL.h`, `oo_READ_TEXT.h`, `oo_WRITE_BINARY.h`, etc., which auto-generate `v1_copy`, `v1_equal`, `v1_writeText`, `v1_writeBinary` virtual method bodies.

This avoids writing repetitive serialization code by hand.

### Memory management

Praat uses its own `auto*` RAII wrappers (`autoThing`, `autoSound`, `autoVEC`, `autoMAT`, …) which are move-only smart pointers with `move()` semantics. The `autoSomeThing<T>` template implements ownership transfer.

---

## 6. GUI Abstraction Layer

`sys/Gui.h` selects the widget backend at compile time:

```cpp
#if defined(UNIX)       → gtk = 1  (GTK3)
#if defined(_WIN32)     → motif = 1  (Win32 + Motif emulator)
#if defined(macintosh)  → cocoa = 1
```

All widget types (`GuiButton`, `GuiMenu`, `GuiMenuItem`, `GuiList`, `GuiDrawingArea`, etc.) expose a platform-independent C++ API. Internally they wrap:
- **GTK3** widgets on Linux (GtkButton, GtkMenu, etc.)
- **Win32** controls behind `motifEmulator.cpp` (a ~7,000-line file that simulates Motif semantics using Win32 calls)
- **Cocoa** NSButton/NSMenu etc. on macOS

The `GuiDrawingArea` widget is the canvas on which `GraphicsScreen` paints.

---

## 7. The Graphics Subsystem

`sys/Graphics.h` defines an abstract `Graphics` object with ~150 drawing primitives:
- `Graphics_line`, `Graphics_fillRectangle`, `Graphics_circle`, `Graphics_ellipse`
- `Graphics_text` (full Unicode, right-to-left, IPA, sub/superscripts via longchar escapes)
- `Graphics_image` (bitmap blitting)
- `Graphics_setWindow`, `Graphics_setViewport` (coordinate transformations)
- `Graphics_polyline`, `Graphics_surface` (3-D altitude plots)

Concrete subclasses:
- `GraphicsScreen` — renders to the platform screen (Cairo on Linux, Quartz on macOS, GDI+ on Windows)
- `GraphicsPostscript` — writes EPS/PS files
- `Graphics` (with record/replay) — `Graphics_record.cpp` records drawing commands into a display list that can be replayed (used for printing)

All coordinates use a normalized device coordinate (NDC) system (0.0–1.0 mapped to the viewport), with world coordinates (WC) set separately per plot.

---

## 8. The Scripting Engine

### Overview

Praat Script is a dynamically typed interpreted language embedded directly in `sys/`:

```
Source text (.praat file)
    │
    ▼
Lexer / tokenizer (inside Interpreter.cpp)
    │
    ▼
Formula / expression evaluator (Formula.cpp)
    │
    ▼
Interpreter.cpp — line-by-line execution
    │
    ├─ Variable table (hash map: name → InterpreterVariable)
    ├─ Call stack (max 50 frames)
    └─ Command dispatch → praat_executeCommand()
               │
               ▼
       praat_actions / praat_menuCommands
               │
               ▼
       C++ callback functions (DO_Sound_filter, etc.)
```

### Variable types

| Variable suffix | Type |
|---|---|
| (none) | Numeric (double, integer, or boolean) |
| `$` | String (`char32_t*`) |
| `#` | Numeric vector |
| `##` | Numeric matrix |
| `$#` | String array |

### Formula evaluator

`Formula.cpp` implements a stack-based evaluator. The stack element (`Stackel`) can hold a number, string, vector, matrix, tensor3, tensor4, string array, a variable reference, or an object reference. Maximum stack depth is 1,000,000 elements (~32 MB).

### Editor scripts

Each `Editor` subclass can register its own set of commands (via `Editor_addCommand`), and these appear in the editor's menus and can be invoked from scripts using:

```praat
editor: "TextGrid helloworld"
    Zoom: 0, 1
endeditor
```

---

## 9. Audio I/O Pipeline

### Playback

```
Sound object (double[] PCM)
    │ Sound_playPart()
    ▼
Sound_audio.cpp → MelderAudio_play16()
    │  (converts to int16, adds silence padding)
    ▼
melder_audio.cpp → platform dispatch:
    ├─ Linux: PulseAudio or ALSA (via PortAudio)
    ├─ macOS: CoreAudio (via PortAudio)
    └─ Windows: WASAPI or WDM (via PortAudio)
```

Playback is asynchronous; a callback function reports samples played, allowing cancellation and cursor animation.

### Recording

```
SoundRecorder GUI
    │ → MelderAudio_openRecording()
    ▼
PortAudio input stream
    │ (platform: ALSA/PulseAudio/CoreAudio/WASAPI)
    ▼
int16 ring buffer
    │
    ▼
Sound object (on "Save to list")
```

### Audio file formats supported

| Format | Read | Write | Library |
|---|---|---|---|
| WAV | ✓ | ✓ | built-in |
| AIFF/AIFC | ✓ | ✓ | built-in |
| FLAC | ✓ | ✓ | `external/flac` |
| MP3 | ✓ | — | `external/mp3` (minimp3) |
| Ogg Vorbis | ✓ | ✓ | `external/vorbis` |
| Opus | ✓ | — | `external/opusfile` |
| NeXT/AU | ✓ | ✓ | built-in |
| raw PCM | ✓ | ✓ | built-in |
| Kay/CSRE | ✓ | — | built-in |

---

## 10. File I/O & Serialization

Praat uses two serialization formats for its own objects:

### Text format (`.Collection`, `.TextGrid`, etc.)

Human-readable UTF-8 with a header:

```
File type = "ooTextFile"
Object class = "Sound"
...
```

Generated automatically from `_def.h` via `oo_WRITE_TEXT.h`.

### Binary format (`.Sound`, etc.)

Big-endian IEEE 754 with the same header format. Generated from `_def.h` via `oo_WRITE_BINARY.h`.

### Cross-platform consistency

All binary formats use big-endian byte order, even on little-endian machines (via `abcio` primitives), ensuring that files are platform-independent.

---

## 11. Key Phonetic Data Types

### `Sound`

```
Inherits: Vector → Matrix → SampledXY → Sampled → Function → Daata → Thing

Fields:
  xmin, xmax    : time domain (seconds)
  nx            : number of samples
  dx            : sample period (1/fs)
  x1            : time of first sample
  ny            : number of channels
  z[ny][nx]     : amplitude values (double, range ≈ ±1.0 Pa)
```

### `Pitch`

```
Inherits: Sampled → Function → Daata → Thing

Fields:
  xmin, xmax, nx, dx, x1   : time grid
  ceiling                    : maximum frequency (Hz)
  frame[nx]:
    nCandidates               : number of pitch candidates per frame
    candidate[]:
      frequency               : in Hz (0 = unvoiced)
      strength                : autocorrelation coefficient
```

### `TextGrid`

```
Inherits: Function → Daata → Thing

Fields:
  xmin, xmax         : total time domain
  tiers : Ordered<AnyTier>
    Each tier is either:
      IntervalTier:
        xmin, xmax
        intervals : SortedSet<TextInterval>
          each: tmin, tmax, text
      TextTier:
        xmin, xmax
        points : SortedSet<TextPoint>
          each: time, mark
```

---

## 12. User-Side Workflow

### Step-by-step

1. **Load audio** — drag-drop or `Open → Read from file…` (WAV, AIFF, FLAC, MP3, etc.), or record via `New → Record mono/stereo Sound…`
2. **Inspect** — `View & Edit` opens the `SoundEditor`: an interactive waveform viewer with overlaid pitch contour, spectrogram, intensity curve, formant dots, and glottal pulse marks
3. **Select** — drag in the waveform to set a time selection; use Praat Script to select precise intervals
4. **Analyse** — run `Analyse → Periodicity → To Pitch…`, `To Formant (Burg)…`, `Spectral → To Spectrogram…`, etc. Each creates a new derived object in the list
5. **Annotate** — create a `TextGrid` with tiers for phones, words, etc.; edit in `TextGridEditor` (showing waveform + annotation tiers side-by-side)
6. **Manipulate** — use `Manipulation` objects (PSOLA resynthesis) to alter pitch and duration; use `KlattGrid` or `FormantGrid` for parametric synthesis
7. **Query/export** — select derived objects and run `Query → Get mean…`, `Get maximum…` etc.; results appear in the Info window
8. **Picture** — `Draw → Draw…` or `Paint spectrogram…` sends plots to the Picture window, which exports to EPS/PDF/PNG
9. **Script** — the entire workflow can be replicated/batched via Praat Script

### Objects window

The central `Objects window` lists all currently loaded objects (each typed: `1. Sound helloworld`, `2. TextGrid helloworld`, etc.). Multi-selection activates context-sensitive menus in the right panel (`View & Edit`, `To Pitch…`, `Save…`, etc.). These are registered via `praat_addAction1/2/3/4`.

### Picture window

A separate `Picture window` is a persistent canvas into which analyses can be drawn. Everything drawn there is vector-based (using the `Graphics` abstraction) and can be exported to EPS/PDF/PNG.

### Scripting

Praat Script allows full automation of all GUI operations:

```praat
sound = Read from file: "hello.wav"
selectObject: sound
To Pitch: 0, 75, 600
pitch = selected("Pitch")
f0 = Get mean: 0, 0, "Hertz"
writeInfoLine: "Mean F0 = ", f0, " Hz"
```

Scripts can be run from the `Praat → Open Praat Script…` menu, from the command line (`praat myscript.praat`), or via `praatlib` from C/Python/R.

---

## 13. Build System

### Platforms & build tools

| Platform | Build method | Compiler |
|---|---|---|
| macOS | Xcode (`.xcodeproj`) | Clang (LLVM) |
| Windows | MSYS2 Makefile | Clang (ARM64/x64) or GCC (i686) |
| Linux / ChromeOS | GNU Make or Meson | Clang or GCC |
| Raspberry Pi | GNU Make | GCC |
| LinuxONE (s390x) | GNU Make | GCC |

### Build variants

| Variant | Flags | Description |
|---|---|---|
| Full GUI | (default) | GTK3 + Cairo + Pango + PortAudio |
| `nogui` | `-DNO_GUI` (with graphics) | No interactive window; Cairo/Pango still available |
| `barren` | `-DNO_GRAPHICS -DNO_GUI` | Headless batch processing only |

### Required system libraries (Linux example)

```
libgtk-3-dev, libcairo2-dev, libpango1.0-dev
libasound2-dev, libpulse-dev, libjack-dev
```

### Meson support

A `meson.build` exists in the root and in each module directory (as an alternative to Make), but Make is the primary build system for non-macOS platforms.

### Code standards

- C++17 required (`std::optional`, structured bindings, `if constexpr`, etc.)
- C99 for the external C libraries
- Errors propagate via C++ `throw MelderError` / `catch` blocks (not traditional exceptions with payloads — the error message is accumulated in a global buffer then thrown as a tag type)

---

*Document compiled from source analysis of `~/dev/praat` (November 2026).*
