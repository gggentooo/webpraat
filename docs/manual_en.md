# WebPraat User Manual

> **A Practical Guide to Acoustic Phonetics and Speech Analysis in WebPraat**  

---

## Table of Contents

1. [Introduction](#1-introduction)
   - [What is WebPraat?](#what-is-webpraat)
   - [Screen Layout Overview](#screen-layout-overview)
   - [Privacy & Local Processing](#privacy--local-processing)
2. [Top Menu Bar Reference](#2-top-menu-bar-reference)
   - [Praat Menu](#praat-menu)
   - [New Menu](#new-menu)
   - [Open Menu](#open-menu)
   - [Save Menu](#save-menu)
   - [Help Menu](#help-menu)
   - [Language Switcher](#language-switcher)
3. [The Praat Objects Window](#3-the-praat-objects-window)
   - [Understanding Praat Objects](#understanding-praat-objects)
   - [Selecting & Importing Objects](#selecting--importing-objects)
   - [Fixed Bottom Action Buttons](#fixed-bottom-action-buttons)
   - [Dynamic Actions by Object Type](#dynamic-actions-by-object-type)
4. [Sound Editor: Waveforms & Spectrograms](#4-sound-editor-waveform--spectrogram)
   - [Opening the Sound Editor](#opening-the-sound-editor)
   - [Waveform Display](#waveform-display)
   - [Spectrogram Display](#spectrogram-display)
   - [Acoustic Overlays (Pitch, Formants, Intensity)](#acoustic-overlays)
   - [Navigation & Zooming](#navigation--zooming)
   - [Audio Playback & Selection](#audio-playback--selection)
5. [TextGrid Editor & Phonetic Annotation](#5-textgrid-editor--phonetic-annotation)
   - [What is a TextGrid?](#what-is-a-textgrid)
   - [Opening Sound & TextGrid Together](#opening-sound--textgrid-together)
   - [Adding & Manipulating Boundaries](#adding--manipulating-boundaries)
   - [Typing Labels & The IPA Palette](#typing-labels--the-ipa-palette)
   - [TextGrid Menu Reference](#textgrid-menu-reference)
6. [Praat Picture: Creating Publication-Quality Figures](#6-praat-picture)
   - [The Picture Page & Viewports](#the-picture-page--viewports)
   - [Drawing Waveforms, Spectrograms & Contours](#drawing-waveforms-spectrograms--contours)
   - [Styles, Axes & Titles](#styles-axes--titles)
   - [Exporting Figures (PNG & SVG)](#exporting-figures)
7. [Sound Recorder: Capturing Audio from Microphone](#7-sound-recorder)
   - [Setting Up Recording](#setting-up-recording)
   - [Monitoring Levels & Preventing Clipping](#monitoring-levels--preventing-clipping)
   - [Saving to Objects](#saving-to-objects)
8. [Praat Scripting: Automating Linguistic Analyses](#8-praat-scripting)
   - [Opening & Writing Scripts](#opening--writing-scripts)
   - [Running Scripts & Reading Output](#running-scripts--reading-output)
   - [Interactive Forms (`form ... endform`)](#interactive-forms)
   - [The Floating Pause Window (`[Next]` / `[Stop]`)](#the-floating-pause-window)
   - [Mounting Local Folders for Batch Processing](#mounting-local-folders)
9. [Info Window & Workspace Persistence](#9-info-window--workspace-persistence)
   - [Reading Query Results](#reading-query-results)
   - [Browser Workspace Auto-Save](#browser-workspace-auto-save)
10. [Keyboard Shortcuts Reference](#10-keyboard-shortcuts-reference)

---

## 1. Introduction

### What is WebPraat?
**WebPraat** brings the gold-standard desktop phonetics application, **Praat** (originally created by Paul Boersma and David Weenink at the University of Amsterdam), directly into modern web browsers. It runs the genuine Praat acoustic analysis engine locally on your device, allowing you to perform acoustic measurements, speech segmentation, pitch tracking, formant estimation, and spectral analysis without installing software or compiling source code.

### Screen Layout Overview
When you open WebPraat, you will see a clean, unified workspace divided into several functional zones:

1. **Top Menu Bar**: Global file operations, microphone recording, audio synthesis, file saving, script creation, workspace management, and language switching.
2. **Left Pane (Praat Objects Window)**:
   - **Objects List**: Displays all loaded or calculated items (e.g., `Sound`, `TextGrid`, `Pitch`, `Formant`, `Spectrogram`).
   - **Dynamic Action Bar**: Displays context-sensitive buttons that adapt automatically depending on which object (or combination of objects) is selected.
   - **Fixed Bottom Buttons**: Universal actions (`Rename...`, `Copy...`, `Inspect`, `Info`, `Remove`).
3. **Right Pane (Workspace / Editors / Picture)**:
   - **Tabs**: Switch between `Praat Picture`, active `Sound Editor`, active `TextGrid Editor`, and the `Praat Script` console.
   - **Editor Canvas**: Interactive waveform, spectrogram, and annotation tier canvas.
4. **Bottom Right (Praat Info Window)**:
   - Text console displaying numeric query results (durations, pitch frequencies, formant values, script outputs) with one-click **Copy** and **Clear** tools.

### Privacy & Local Processing
> [!NOTE]
> All speech processing, microphone recordings, audio playback, and script executions in WebPraat happen **100% locally inside your web browser**. No speech data, recordings, or annotations are ever transmitted over the network or stored on external servers.

---

## 2. Top Menu Bar Reference

The menu bar at the top of the screen provides general commands organized into standard categories:

### Praat Menu
- **New Praat script**: Clears the scripting console to start writing a fresh Praat batch script named `untitled.praat`.
- **Open Praat script...**: Opens a file dialog to load an existing `.praat`, `.psc`, or `.txt` script from your computer into the Script tab.
- **Mount local folder...**: Connects a local folder on your computer (using the browser's File System Access API) directly into WebPraat's virtual workspace (`/workspace/<folderName>`). This enables scripts to read audio files and save `.TextGrid` files directly to your hard drive.
- **Save workspace**: Manually saves all currently loaded Praat objects and script text into your browser's private offline storage.
- **Clear saved workspace**: Clears the saved offline workspace data.
- **Clear Info**: Erases all text currently printed in the Praat Info window.
- **Source (GitHub)**: Opens the official WebPraat source code repository in a new tab.

### New Menu
- **Record mono Sound...**: Opens the SoundRecorder dialog to capture single-channel audio from your microphone.
- **Record stereo Sound...**: Opens the SoundRecorder dialog to record two-channel audio.
- **Create Sound as pure tone...**: Generates a synthetic sine wave by specifying name, frequency (Hz), duration (seconds), sampling rate (Hz), and amplitude.
- **Create KlattGrid from vowel...**: Generates a Klatt synthesizer parameter grid initialized with standard acoustic formant presets (F1, F2, F3, F4) and fundamental frequency (F0).
- **Create Speaker...**: Generates an articulatory synthesizer speaker model (Female, Male, or Child).
- **Create Artword...**: Creates an articulatory vocal tract motion target for speech synthesis.

### Open Menu
- **Read from file...**: Opens a file chooser to load audio files (`.wav`, `.mp3`, `.flac`, `.ogg`, `.aiff`) or annotation files (`.TextGrid`). You can also drag and drop files directly onto the Objects list.
- **Mount local folder...**: Quick shortcut to mount a local directory for batch processing.

### Save Menu
- **Save as WAV file...**: Exports the currently selected `Sound` object as a standard uncompressed 16-bit PCM `.wav` file to your computer's downloads folder. *(Enabled only when a Sound object is selected).*
- **Save as TextGrid file...**: Exports the currently selected `TextGrid` object as a standard Praat `.TextGrid` text file. *(Enabled only when a TextGrid object is selected).*

### Help Menu
- **Praat manual...**: Links directly to the comprehensive official Praat reference documentation maintained by the University of Amsterdam.
- **About WebPraat...**: Displays version information, core engine credits, and author acknowledgments.

### Language Switcher
Located at the top right of the menu bar:
- **EN**: Displays the user interface in standard English (matching desktop Praat terminology).
- **한국어**: Switches all menu labels, dialog prompts, and buttons to Korean.

---

## 3. The Praat Objects Window

The Praat Objects window (the left pane) is the control center for your data.

### Understanding Praat Objects
Everything you create, import, or calculate in WebPraat is stored as an **Object** with a numeric ID, a type, and a name:
- **`Sound`**: Raw acoustic waveform data (channels, sample rate, amplitude samples over time).
- **`TextGrid`**: Temporal segmentation and transcription tiers (intervals and point markers).
- **`Pitch`**: Fundamental frequency ($F_0$) candidate tracks over time.
- **`Formant`**: Vocal tract resonance estimates ($F_1, F_2, F_3, \dots$) and bandwidths.
- **`Spectrogram`**: Time-frequency-energy matrix.
- **`Intensity`**: Acoustic energy contour (dB) over time.
- **`PowerCepstrogram` / `CPP`**: Cepstral peak prominence representations for voice quality analysis.

### Selecting & Importing Objects
- **Single Click**: Selects an object and updates the dynamic action buttons on the right side of the Objects panel.
- **Multiple Selection**: Hold `Ctrl` (Windows/Linux) or `Cmd` (macOS) and click to select multiple objects simultaneously (for example, selecting a `Sound` and a `TextGrid` together).
- **Range Selection**: Hold `Shift` and click to select an inclusive range of objects.
- **Double Click**: Double-clicking a `Sound` opens the **Sound Editor**; double-clicking a `TextGrid` opens the **TextGrid Editor**.
- **Drag & Drop**: Drag audio files (`.wav`, `.mp3`, `.flac`) or `.TextGrid` files from your computer and drop them anywhere onto the Objects list to load them immediately.

### Fixed Bottom Action Buttons
At the bottom of the Objects window are five universal buttons:
- **Rename...**: Change the name of the selected object.
- **Copy...**: Create an identical duplicate of the selected object under a new name.
- **Inspect**: Open detailed structural properties of the object in the Info window.
- **Info**: Output full acoustic metadata (duration, sample rate, frame count, min/max values) into the Info window.
- **Remove**: Delete the selected object(s) from memory.

---

### Dynamic Actions by Object Type

When you select an object in the list, the action bar provides operations specific to that object type:

#### When a `Sound` is Selected
- **`View & Edit`**: Opens the waveform and spectrogram in the Sound Editor.
- **`Play` / `Stop`**: Instantly auditions the entire audio file through your speakers.
- **`Draw...`**: Draws the sound waveform into the Praat Picture sheet.
- **`To Pitch...`**: Calculates fundamental frequency ($F_0$) using autocorrelation.
  - *Parameters*: Time step (s), Pitch floor (Hz, default 75 Hz), Pitch ceiling (Hz, default 500 Hz).
- **`To Formant (burg)...`**: Estimates vowel formants using Burg's linear predictive algorithm.
  - *Parameters*: Maximum formants (typically 5 for human speech), Formant ceiling (5500 Hz for female/child voices, 5000 Hz for male voices), Window length (s).
- **`To Spectrogram...`**: Computes time-frequency spectral energy.
  - *Parameters*: Window length (0.005 s for wideband, 0.03 s for narrowband), Maximum frequency (Hz).
- **`To Intensity...`**: Computes overall loudness/energy curve in dB.
- **`To TextGrid...`**: Creates a blank annotation TextGrid matching the exact start and end times of the sound.
  - *Parameters*: `All tier names` (e.g. `sentence word phone`), `Which of these are point tiers?`.
- **Advanced DSP**:
  - `To PowerCepstrogram...`: Computes cepstral representations.
  - `To LPC (burg)...`: Linear Predictive Coding filter analysis.
  - `To MFCC...`: Mel-Frequency Cepstral Coefficients for acoustic classification.
  - `To KlattGrid (simple)...`: Synthesizer parameter extraction.
- **Sound Queries (Acoustic Measurements)**:
  - `Get number of channels`: 1 for mono, 2 for stereo.
  - `Get number of samples`: Total sample count.
  - `Get sampling frequency`: Audio sampling rate in Hertz (e.g., 44100 Hz).
  - `Get sampling period`: Duration of one sample interval ($\Delta t = 1 / f_s$).
  - `Get total duration`: Length of the audio file in seconds.
  - `Get mean...`: Mean amplitude value across a selected time range.
  - `Get root-mean-square...`: RMS energy amplitude across a time range.
  - `Get value at time...`: Instantaneous amplitude sample at a specified second.

#### When a `Pitch` Object is Selected
- **`Draw...`**: Draws the pitch curve as a continuous line in Praat Picture.
- **`Speckle...`**: Draws individual pitch candidate points in Praat Picture.
- **`Get mean...`**: Computes average $F_0$ (Hz) within a given time interval.
- **`Get value at time...`**: Queries pitch frequency at an exact time point.
- **`Count voiced frames`**: Returns how many frames were identified as voiced speech.
- **Synthesise**:
  - `To Sound (pulses)`: Synthesizes a periodic pulse train matching the pitch contour.
  - `To Sound (hum)`: Synthesizes a sinusoidal hum tracking the pitch contour.
  - `To Sound (sine)...`: Generates a pure harmonic sine sweep following $F_0$.

#### When a `Formant` Object is Selected
- **`Draw...` / `Speckle...`**: Plots formant tracks ($F_1, F_2, F_3$) in Praat Picture.
- **`Down to Table...`**: Exports all time frames, formant frequencies, and bandwidths into a structured tabular data format.
- **`Track...`**: Fits continuous formant paths through candidate frequencies.

#### When a `Spectrogram` Object is Selected
- **`Paint...`**: Paints the time-frequency spectrogram into Praat Picture.
- **`To Spectrum (slice)...`**: Extracts a single spectral slice (FFT amplitude spectrum) at a specific time point.

#### When a `TextGrid` Object is Selected
- **`View & Edit`**: Opens the annotation tiers in the TextGrid Editor.
- **`Export .TextGrid`**: Saves the TextGrid directly to a text file.
- **`Draw...`**: Draws annotation tiers and boundary text labels into Praat Picture.

#### When a `Sound` and `TextGrid` are Selected Together
- **`View & Edit`**: Opens the **integrated Sound + TextGrid Editor**, displaying the acoustic waveform, spectrogram, and annotation tiers simultaneously in complete time synchronization.

---

## 4. Sound Editor: Waveform & Spectrogram

The **Sound Editor** allows you to inspect speech acoustics visually and take precise measurements.

```
+-------------------------------------------------------------------+
|  [Waveform Canvas]           Amplitude (-1.0 to +1.0)             |
|                                                                   |
+-------------------------------------------------------------------+
|  [Spectrogram Canvas]        Frequency (0 to 5000 Hz)             |
|   ~ ~ ~ ~ ~ ~ (Pitch: Blue Line) ~ ~ ~ ~ ~ ~                      |
|   . . . . . . (Formants: Red Dots) . . . . .                      |
|   - - - - - - (Intensity: Green Line) - - - -                     |
+-------------------------------------------------------------------+
| [all] [in] [out] [sel] [bak] | [Play Window] [Play Selection]     |
+-------------------------------------------------------------------+
```

### Opening the Sound Editor
Select any `Sound` object in the list and click **View & Edit** (or simply double-click the object).

### Waveform Display
The upper canvas displays the amplitude waveform over time.
- **Vertical Axis**: Relative sound pressure amplitude (normalized between $-1.0$ and $+1.0$).
- **Horizontal Axis**: Time in seconds.
- **Zero-crossing Line**: Dotted center line representing atmospheric rest pressure.

### Spectrogram Display
The lower canvas shows energy distribution across frequencies over time:
- **Vertical Axis**: Frequency from $0\text{ Hz}$ up to the ceiling (typically $5000\text{ Hz}$).
- **Horizontal Axis**: Time in seconds.
- **Darkness / Color**: Energy level in decibels (dB). Darker regions indicate vowel formants, harmonic bands, or frication noise.
- **Greyscale vs. Colour**: Toggle between classic Praat black-and-white print mode or a high-contrast colour heatmap.

### Acoustic Overlays
Use the checkboxes in the toolbar above the editor to toggle real-time acoustic analyses:
- **Show pitch (Blue line)**: Displays the fundamental frequency ($F_0$) contour. Useful for analyzing intonation, lexical tone, and vocal fold vibration.
- **Show formants (Red dots)**: Displays estimated formant center frequencies ($F_1$ through $F_5$). Essential for vowel space analysis and consonant transitions.
- **Show intensity (Green curve)**: Displays acoustic energy in decibels ($\text{dB}$) across time, showing stress peaks and syllabic rhythm.

### Navigation & Zooming
Navigate long audio recordings using the five zoom buttons at the bottom-left:
- **`all`**: Zooms out completely to show the entire audio recording.
- **`in`**: Zooms in by a factor of 2 toward the center of the current view.
- **`out`**: Zooms out by a factor of 2.
- **`sel`**: Zooms directly into the currently highlighted time selection.
- **`bak`**: Steps back to the previous zoom viewport level.

### Audio Playback & Selection
- **Selecting Time Ranges**: Click and drag horizontally across either the waveform or spectrogram canvas to highlight a segment.
- **Single Cursor Click**: Clicking once places a vertical cursor line at that exact time stamp without a range selection.
- **Play Selection**: Press the **`Spacebar`** (or click the bottom segment bar) to listen to the highlighted portion.
- **Play Visible Window**: Click the lower playback bar to listen to the entire visible time window.
- **Playhead**: An animated vertical line tracks audio playback in real time.

---

## 5. TextGrid Editor & Phonetic Annotation

The **TextGrid Editor** is where phoneticians segment speech, place acoustic boundaries, and label intervals (e.g., words, syllables, phonemes).

```
+-------------------------------------------------------------------+
| File  Edit  Query  Select  Interval  Boundary  Tier               |
+-------------------------------------------------------------------+
|  [Waveform Canvas]                                                |
+-------------------------------------------------------------------+
|  [Text Input Bar:  | kʰ |             ] [IPA Palette ▼]           |
+-------------------------------------------------------------------+
| Tier 1 (words)    |      cat      |          sat          |       |
| Tier 2 (phones)   | kʰ | æ |  t   |   s   |   æ   |   t   |       |
+-------------------------------------------------------------------+
```

### What is a TextGrid?
A TextGrid is Praat's annotation file containing one or more stacked **Tiers**:
- **Interval Tier**: Segments time into contiguous labeled intervals (e.g., separating an utterance into words or individual phonetic segments). Each interval has a start time, end time, and text label.
- **Point Tier (Text Tier)**: Marks instantaneous events at single points in time (e.g., release bursts, pitch peaks, voice onset timing).

### Opening Sound & TextGrid Together
To annotate audio:
1. In the Objects window, click your `Sound` object.
2. Hold `Ctrl` (or `Cmd`) and click your `TextGrid` object so both are highlighted.
3. Click **View & Edit**. Both the audio waveform and the annotation tiers will open together in complete synchronization.

### Adding & Manipulating Boundaries
- **Interactive Cursor Circles**: When you click anywhere on the waveform or tiers, a cursor appears with circular buttons at the top of each tier:
  - Click the **circle on a specific tier** to insert a boundary at that time point on that tier only.
  - Click the **top circle** to insert a boundary at that time point across **all tiers** at once.
- **Keyboard Shortcuts**:
  - Press **`Enter`**: Inserts a boundary at the current cursor time on the currently selected tier.
  - Press **`Ctrl + Enter`** (or `Cmd + Enter`): Inserts a boundary across all tiers simultaneously.
  - Press **`Alt + Backspace`**: Removes the boundary closest to the cursor.
- **Dragging Boundaries**: Click and drag any existing vertical boundary line left or right to fine-tune its acoustic alignment (e.g., snapping it to a burst or voicing onset).

### Typing Labels & The IPA Palette
- **Typing**: Click inside any interval to select it. Type your label directly using your keyboard or the top text entry bar.
- **Moving Between Intervals**:
  - Press **`Tab`** to move selection to the **next interval**.
  - Press **`Shift + Tab`** to move selection to the **previous interval**.
- **IPA Character Palette**: Click the **IPA** button in the editor toolbar to open the phonetic character picker. Click any symbol (e.g., `ə`, `ɪ`, `ʃ`, `θ`, `ŋ`, `kʰ`) to insert it immediately at the cursor position.

### TextGrid Menu Reference

#### File Menu
- **Save as TextGrid file...**: Exports the active annotation to a `.TextGrid` file.
  - *Quick Save*: Press **`Ctrl + S`** (or `Cmd + S`) to instantly save changes. If you mounted a local folder, it writes directly back to your local file!
- **Close**: Exits the editor and returns to the Objects view.

#### Edit Menu
- **Undo (`Ctrl + Z` / `Cmd + Z`)**: Reverts the last boundary creation, deletion, drag, or text edit.
- **Redo (`Ctrl + Y` / `Cmd + Y`)**: Reapplies the previously undone action.
- **Cut / Copy / Paste text**: Standard text editing tools for interval labels.

#### Query Menu
- **Get time of cursor**: Displays the cursor's exact time coordinate in seconds in the Info window.
- **Get selection start / end / length**: Measures duration and boundary timestamps of the selected interval.
- **Get label of interval**: Prints the text of the selected interval into Info.
- **Get number of tiers**: Returns the total tier count.
- **Get number of intervals**: Returns how many segments exist on the current tier.

#### Select Menu
- **Move cursor to start of selection**: Snaps cursor to the left boundary.
- **Move cursor to end of selection**: Snaps cursor to the right boundary.
- **Select previous interval (`Shift + Tab`)**: Steps selection one interval to the left.
- **Select next interval (`Tab`)**: Steps selection one interval to the right.

#### Interval Menu
- **New interval on tier...**: Inserts boundaries at both the start and end of the current time selection on the active tier.
- **Remove interval**: Deletes the interval's boundaries and merges its duration into the adjacent interval.
- **Set interval text...**: Opens a modal dialog to enter or modify the label.
- **Clear interval text**: Clears the text string inside the active interval while preserving its boundaries.

#### Boundary Menu
- **Add boundary at cursor on tier... (`Enter`)**: Drops a boundary on the active tier.
- **Add boundary on all tiers (`Ctrl/Cmd + Enter`)**: Drops synchronized boundaries across every tier.
- **Remove boundary at cursor (`Alt + Backspace`)**: Deletes the boundary under the cursor.
- **Move nearest boundary to cursor**: Relocates the closest boundary to the exact position of your cursor line.

#### Tier Menu
- **Add interval tier...**: Prompts for a tier name and numerical position (e.g., position `1` inserts at the top) to add an interval tier.
- **Add point tier...**: Inserts a new point tier for timestamp markers.
- **Duplicate tier...**: Creates an exact copy of an existing tier.
- **Rename tier...**: Renames the selected tier.
- **Remove tier**: Deletes the active tier after a safety confirmation prompt.

---

## 6. Praat Picture: Creating Publication-Quality Figures

The **Praat Picture** tab generates crisp, publication-ready vector diagrams for course assignments, lab reports, presentations, and theses.

### The Picture Page & Viewports
- Praat Picture simulates a standard **12" × 12" publication sheet**.
- **Selecting Viewports**: Click and drag your mouse across the white canvas to define an active rectangular box (outer viewport) measured in inches.
- Any subsequent `Draw...` or `Paint...` command from the Objects list will render directly inside that specified box.

### Drawing Waveforms, Spectrograms & Contours
1. In the **Praat Picture** tab, drag a box (e.g., from `1.0` to `5.0` inches horizontally and `1.0` to `3.0` inches vertically).
2. Switch to the **Praat Objects** window.
3. Select your `Sound` object and click **`Draw...`**.
4. In the dialog box, set your time range (`0.0 = all`) and click **OK**. The waveform is drawn neatly inside your chosen box.
5. Drag another box immediately below the first one, select your `Spectrogram`, and click **`Paint...`** to create a paired waveform-spectrogram diagram!

### Styles, Axes & Titles
Use the toolbar controls in the Praat Picture tab to style your drawing:
- **Colour**: Choose from standard Praat pen colors (Black, White, Red, Green, Blue, Cyan, Magenta, Yellow, Grey).
- **Line width**: Adjust pen thickness (1.0, 1.5, 2.0, etc.).
- **Line style**: Select Solid, Dotted, Dashed, or Dash-dotted lines.
- **Font size**: Set typography scale (10, 12, 14, 18, 24 pt).
- **Draw inner box**: Draws a clean bounding border around the active viewport.
- **Text top...**: Adds a centered title or description above the active box.
- **Garnish**: When checked in drawing dialogs, automatically draws coordinate axes with numeric tick marks and unit labels.
- **Erase all**: Clears the entire drawing sheet.

### Exporting Figures
Once your figure is ready:
- **Save as PNG file...**: Downloads a high-resolution raster image suitable for Word documents and PowerPoint slides.
- **Save as SVG file...**: Downloads a scalable vector graphic (`.svg`) that maintains infinite sharpness at any print size or resolution.

---

## 7. Sound Recorder: Capturing Audio from Microphone

WebPraat allows you to record speech samples directly inside your browser without third-party audio recording software.

### Setting Up Recording
1. Go to the top menu and select **`New > Record mono Sound...`** (or `Record stereo Sound...`).
2. If prompted by your browser, grant microphone access permissions.
3. Choose your settings:
   - **Input source**: Select your desired microphone or external USB audio interface.
   - **Sampling frequency**: Choose your sample rate (e.g., `44100 Hz` for general acoustic analysis, or `16000 Hz` for speech recognition tasks).
   - **Name**: Enter an identifier for the recording (defaults to `untitled`).

### Monitoring Levels & Preventing Clipping
- Speak into your microphone and observe the real-time **VU Meter**:
  - **Green / Yellow**: Ideal recording signal level.
  - **Red / `CLIP` indicator**: The signal is too loud and distorted. Lower your system microphone input volume or move slightly further from the mic.
- A live oscilloscope preview displays the incoming waveform in real time.

### Saving to Objects
1. Click **`Record`** to begin capturing audio.
2. Speak your speech tokens clearly.
3. Click **`Stop`** when finished.
4. Click **`Play`** to audition the recording and verify quality.
5. Click **`Save to list & Close`** (or `Save to list`). Your new `Sound` object appears immediately in the Praat Objects window, ready for pitch, formant, or TextGrid analysis!

---

## 8. Praat Scripting: Automating Linguistic Analyses

Praat scripts allow you to automate repetitive tasks—such as batch-extracting vowel formant measurements from 100 audio files or opening files sequentially for rapid annotation.

### Opening & Writing Scripts
- Click the **Praat Script** tab in the main editor pane (or choose **`Praat > New Praat script`** / **`Open Praat script...`**).
- The built-in editor features syntax highlighting, line numbers, and indentation for standard Praat script code.
- Use the **Sample scripts...** dropdown to explore starter templates:
  - *Loop & Math calculations*
  - *Procedures & Strings*
  - *Batch Variable Operations*
  - *Praat Picture Drawing*

### Running Scripts & Reading Output
- Click **`Run`** in the script toolbar (or press **`Ctrl + Enter`** / **`Cmd + Enter`**).
- Outputs printed with `writeInfoLine:` or `appendInfoLine:` appear in the **Praat Info** window at the bottom right.

### Interactive Forms (`form ... endform`)
When a script begins with a Praat `form` block:
```praat
form Measure Vowels
    sentence Speaker_ID Speaker01
    positive Pitch_floor 75
    positive Pitch_ceiling 500
    boolean Skip_unvoiced 1
endform
```
WebPraat automatically detects the form and presents an interactive dialog box before execution starts. You can configure parameter values visually, and WebPraat binds them seamlessly to the script's variables.

### The Floating Pause Window (`[Next]` / `[Stop]`)
In transcription and annotation scripts (such as those used in phonetics lab courses), scripts pause execution to let you annotate an audio file before proceeding:
```praat
beginPause: "Annotation Task"
    comment: "Annotate the vowels in the TextGrid Editor."
    comment: "Press Next to continue, or Stop to finish."
clicked = endPause: "Stop", "Next", 2
```
When this runs:
1. WebPraat halts the script cleanly and displays a floating, draggable **Script Pause Window** containing your custom buttons.
2. The main workspace **remains fully responsive**: you can play audio, zoom the spectrogram, add boundaries, and edit labels without interruption.
3. When you finish annotating, press **`Ctrl + S`** to save your TextGrid, then click **`[Next]`** on the floating pause window. The script immediately opens the next audio file!

### Mounting Local Folders for Batch Processing
To run scripts over an entire directory of audio files on your computer:
1. Click **`Mount local folder...`** under the **Open** or **Praat** menu (or inside the Script tab).
2. Choose your project directory (for example, a folder containing `.wav` files and a `textgrids/` subfolder).
3. Grant read/write permissions when prompted by your browser.
4. Your folder is mounted at `/workspace/<folderName>`. Praat commands like `Create Strings as file list:` and `Read from file:` can now read files and save annotations directly to your hard drive.

---

## 9. Info Window & Workspace Persistence

### Reading Query Results
Whenever you run an acoustic query (such as `Get mean...`, `Get pitch`, or `Get total duration`), the numeric answer is printed into the **Praat Info** window at the bottom right:
- Click **`Copy`** to copy the query text directly to your clipboard (ready to paste into Excel, R, Google Sheets, or your lab write-up).
- Click **`Clear`** to wipe old results and maintain a clean log.

### Browser Workspace Auto-Save
WebPraat automatically persists your working environment across page reloads using your browser's **Origin Private File System (OPFS)**:
- If you accidentally close your browser tab or refresh the page, your loaded objects and open script code are automatically restored.
- You can manually enforce a save at any time using **`Praat > Save workspace`**, or reset your browser storage using **`Praat > Clear saved workspace`**.

---

## 10. Keyboard Shortcuts Reference

Mastering these shortcuts will greatly speed up your phonetic transcription and acoustic analysis:

| Context | Shortcut | Action |
| :--- | :--- | :--- |
| **Global / Editors** | `Ctrl + Z` / `Cmd + Z` | **Undo** last action |
| | `Ctrl + Y` / `Cmd + Y` | **Redo** action |
| | `Ctrl + Shift + Z` / `Cmd + Shift + Z` | Alternative **Redo** |
| | `Ctrl + S` / `Cmd + S` | **Quick Save** active TextGrid to disk / VFS |
| **Audio Playback** | `Spacebar` | **Play / Stop** selected time segment |
| **Zoom & Viewport** | `Ctrl + A` / `Cmd + A` | Zoom **all** (show complete sound) |
| | `Ctrl + I` / `Cmd + I` | Zoom **in** |
| | `Ctrl + O` / `Cmd + O` | Zoom **out** |
| **TextGrid Annotation** | `Enter` | **Add boundary** at cursor on current tier |
| | `Ctrl + Enter` / `Cmd + Enter` | **Add boundary on all tiers** at cursor |
| | `Alt + Backspace` | **Remove boundary** at cursor |
| | `Tab` | Select **next interval** |
| | `Shift + Tab` | Select **previous interval** |
| **Script Console** | `Ctrl + Enter` / `Cmd + Enter` | **Run** active script |

---

*Happy analyzing! If you encounter issues or have questions regarding underlying acoustic algorithms, refer to the [official Praat manual](https://www.fon.hum.uva.nl/praat/manual/Intro.html).*
