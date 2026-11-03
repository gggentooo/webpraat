/**
 * English localization strings for WebPraat.
 * All English system labels match the original Praat program verbatim.
 */
export const en = {
  // Shell & Window Titles
  app: {
    title: 'WebPraat',
    subtitle: 'Doing phonetics by computer on the web',
    objectsTitle: 'Praat Objects',
    pictureTitle: 'Praat Picture',
    infoTitle: 'Praat Info',
    objectsListHeader: 'Objects:',
  },

  // Menu Bar
  menu: {
    praat: 'Praat',
    new: 'New',
    open: 'Open',
    save: 'Save',
    help: 'Help',
    language: 'Language',
  },

  // Menu Commands
  commands: {
    // Praat menu
    aboutPraat: 'About Praat...',
    aboutWebPraat: 'About WebPraat...',
    sourceGithub: 'Source (GitHub)',
    newPraatScript: 'New Praat script',
    openPraatScript: 'Open Praat script...',
    clearInfo: 'Clear Info',
    saveWorkspace: 'Save workspace',
    clearWorkspace: 'Clear saved workspace',

    // New menu
    recordMonoSound: 'Record mono Sound...',
    recordStereoSound: 'Record stereo Sound...',
    createSoundAsPureTone: 'Create Sound as pure tone...',
    createKlattGridFromVowel: 'Create KlattGrid from vowel...',
    createSpeaker: 'Create Speaker...',
    createArtword: 'Create Artword...',

    // Open menu
    readFromFile: 'Read from file...',
    openLongSoundFile: 'Open long sound file...',
    mountLocalFolder: 'Mount local folder...',

    // Save menu
    saveAsWavFile: 'Save as WAV file...',
    saveAsTextGridFile: 'Save as TextGrid file...',
    saveSelected: 'Save selected...',

    // Help menu
    praatManual: 'Praat manual...',
    intro: 'Intro',
  },

  // Fixed Bottom Buttons on Objects Window
  fixedButtons: {
    rename: 'Rename...',
    copy: 'Copy...',
    inspect: 'Inspect',
    info: 'Info',
    remove: 'Remove',
  },

  // Dynamic Actions
  actions: {
    viewAndEdit: 'View & Edit',
    play: 'Play',
    stop: 'Stop',
    draw: 'Draw...',
    speckle: 'Speckle...',
    query: 'Query -',
    synthesise: 'Synthesise -',
    analysePeriodicity: 'Analyse periodicity -',
    analyseSpectrum: 'Analyse spectrum -',

    // Sound Actions
    soundToPitch: 'To Pitch...',
    soundToFormantBurg: 'To Formant (burg)...',
    soundToSpectrogram: 'To Spectrogram...',
    soundToIntensity: 'To Intensity...',
    soundToTextGrid: 'To TextGrid...',
    soundToPowerCepstrogram: 'To PowerCepstrogram...',
    soundToLpcBurg: 'To LPC (burg)...',
    soundToMfcc: 'To MFCC...',
    soundToKlattGrid: 'To KlattGrid (simple)...',

    // Sound Queries
    getNumChannels: 'Get number of channels',
    getNumSamples: 'Get number of samples',
    getSampleRate: 'Get sampling frequency',
    getSamplePeriod: 'Get sampling period',
    getDuration: 'Get total duration',
    getMean: 'Get mean...',
    getRms: 'Get root-mean-square...',
    getValueAtTime: 'Get value at time...',

    // Pitch Actions
    pitchGetMean: 'Get mean...',
    pitchGetValueAtTime: 'Get value at time...',
    countVoicedFrames: 'Count voiced frames',
    toSoundPulses: 'To Sound (pulses)',
    toSoundHum: 'To Sound (hum)',
    toSoundSine: 'To Sound (sine)...',

    // Formant Actions
    downToTable: 'Down to Table...',
    track: 'Track...',

    // Spectrogram Actions
    paint: 'Paint...',
    toSpectrumSlice: 'To Spectrum (slice)...',

    // TextGrid Actions
    exportTextGrid: 'Export .TextGrid',

    // Advanced DSP Object Actions (Phase 7)
    getCpps: 'Get CPPS...',
    toCpp: 'To CPP...',
    toFormant: 'To Formant',
    toSound: 'To Sound',
    artwordSpeakerToSound: 'To Sound...',
  },

  // Dialogs & Forms
  dialogs: {
    ok: 'OK',
    cancel: 'Cancel',
    apply: 'Apply',
    standards: 'Standards',
    close: 'Close',

    // Rename Dialog
    renameTitle: 'Rename object',
    newName: 'New name',

    // Copy Dialog
    copyTitle: 'Copy object',
    nameOfNewObject: 'Name of new object',

    // Pure Tone Dialog
    pureToneTitle: 'Create Sound as pure tone',
    name: 'Name',
    toneFrequency: 'Frequency (Hz)',
    toneDuration: 'Duration (s)',
    toneSampleRate: 'Sampling frequency (Hz)',
    toneAmplitude: 'Amplitude (0-1)',

    // Sound: To Pitch Dialog
    soundToPitchTitle: 'Sound: To Pitch',
    timeStep: 'Time step (s)',
    timeStepAuto: '0.0 (= auto)',
    pitchFloor: 'Pitch floor (Hz)',
    pitchCeiling: 'Pitch ceiling (Hz)',

    // Sound: To Formant Dialog
    soundToFormantTitle: 'Sound: To Formant (Burg method)',
    maxNumFormants: 'Max. number of formants',
    formantCeiling: 'Formant ceiling (Hz)',
    windowLength: 'Window length (s)',
    preEmphasisFrom: 'Pre-emphasis from (Hz)',

    // Sound: To Spectrogram Dialog
    soundToSpectrogramTitle: 'Sound: To Spectrogram',
    maxFrequency: 'Maximum frequency (Hz)',
    frequencyStep: 'Frequency step (Hz)',
    windowShape: 'Window shape',

    // Sound: To Intensity Dialog
    soundToIntensityTitle: 'Sound: To Intensity',
    subtractMean: 'Subtract mean',

    // Sound: To TextGrid Dialog
    soundToTextGridTitle: 'Sound: To TextGrid',
    tierNames: 'All tier names',
    pointTiers: 'Which of these are point tiers?',

    // Cepstral / CPP Dialogs
    soundToPowerCepstrogramTitle: 'Sound: To PowerCepstrogram',
    powerCepstrogramGetCppsTitle: 'PowerCepstrogram: Get CPPS',
    subtractTrendBeforeSmoothing: 'Subtract trend before smoothing',
    timeAveragingWindow: 'Time averaging window (s)',
    quefrencyAveragingWindow: 'Quefrency averaging window (s)',
    powerCepstrogramToCppTitle: 'PowerCepstrogram: To CPP',
    cppGetMeanTitle: 'CPP: Get mean',

    // LPC & MFCC Dialogs
    soundToLpcBurgTitle: 'Sound: To LPC (burg)',
    predictionOrder: 'Prediction order',
    soundToMfccTitle: 'Sound: To MFCC',
    numCoefficients: 'Number of coefficients',
    f1Mel: 'Position of first filter (mel)',
    dfMel: 'Distance between filters (mel)',
    fmaxMel: 'Maximum frequency (mel)',

    // KlattGrid Dialogs
    createKlattGridFromVowelTitle: 'Create KlattGrid from vowel',
    f0Start: 'Pitch start (Hz)',
    f1Hz: 'Formant 1 frequency (Hz)',
    b1Hz: 'Formant 1 bandwidth (Hz)',
    f2Hz: 'Formant 2 frequency (Hz)',
    b2Hz: 'Formant 2 bandwidth (Hz)',
    f3Hz: 'Formant 3 frequency (Hz)',
    b3Hz: 'Formant 3 bandwidth (Hz)',
    f4Hz: 'Formant 4 frequency (Hz)',
    soundToKlattGridTitle: 'Sound: To KlattGrid (simple)',

    // Articulatory Synthesis Dialogs
    createSpeakerTitle: 'Create Speaker',
    kindOfSpeaker: 'Kind of speaker',
    speakerFemale: 'Female',
    speakerMale: 'Male',
    speakerChild: 'Child',
    numVocalCordMasses: 'Number of tubes in glottis',
    createArtwordTitle: 'Create Artword',
    totalTime: 'Total time (s)',
    defaultVoicedGesture: 'Initialise voiced syllable targets',
    artwordSpeakerToSoundTitle: 'Artword & Speaker: To Sound',
    oversamplingFactor: 'Oversampling factor',

    // Draw Dialog
    drawObjectTitle: 'Draw in Praat Picture',
    minValue: 'Minimum value (0 = auto)',
    maxValue: 'Maximum value (0 = auto)',
    dynamicRangeDb: 'Dynamic range (dB)',
    garnish: 'Garnish',

    // Range queries
    soundGetMeanTitle: 'Sound: Get mean',
    pitchGetMeanTitle: 'Pitch: Get mean',
    pitchGetValueAtTimeTitle: 'Pitch: Get value at time',
    fromTime: 'left Time range (s)',
    toTime: 'right Time range (s)',
    toTimeAll: '(= all)',
    time: 'Time (s)',
    channel: 'Channel (0 = all)',
  },

  // SoundRecorder (Phase 7)
  recorder: {
    monoTitle: 'SoundRecorder (mono)',
    stereoTitle: 'SoundRecorder (stereo)',
    channels: 'Channels',
    mono: 'Mono',
    stereo: 'Stereo',
    inputSource: 'Input source',
    defaultMicrophone: 'Default microphone',
    sampleRate: 'Sampling frequency',
    meter: 'Meter',
    clipping: 'CLIP',
    record: 'Record',
    stop: 'Stop',
    play: 'Play',
    duration: 'Duration',
    name: 'Name',
    saveToList: 'Save to list',
    saveToListAndClose: 'Save to list & Close',
    readyToRecord: 'Click Record to capture audio via AudioWorklet.',
    recordingInProgress: 'Recording from microphone...',
    noRecordingYet: 'No audio recorded yet.',
    permissionDenied: 'Microphone access was denied or no audio input device is available.',
  },

  // Picture Window (Phase 7)
  picture: {
    outerViewport: 'Outer viewport (inches)',
    colour: 'Colour',
    lineWidth: 'Line width',
    lineType: 'Line style',
    solid: 'Solid line',
    dotted: 'Dotted line',
    dashed: 'Dashed line',
    dashDotted: 'Dash-dotted line',
    fontSize: 'Font size',
    garnish: 'Garnish',
    drawInnerBox: 'Draw inner box',
    textTop: 'Text top...',
    enterTitlePrompt: 'Text at top of viewport:',
    undo: 'Undo',
    redo: 'Redo',
    eraseAll: 'Erase all',
    exportPng: 'Save as PNG file...',
    exportSvg: 'Save as SVG file...',
    emptyHint: 'Drag on the 12" × 12" page to select an outer viewport, then click Draw... or Paint... on any object.',
    commandsCount: 'elements',
    closeTab: 'Close Picture',
  },

  // Info Window
  info: {
    clear: 'Clear',
    copy: 'Copy',
    copied: 'Copied!',
    empty: '(No output yet. Select an object and run a Query command or click Info.)',
  },

  // Units & Formats
  units: {
    seconds: 'seconds',
    hz: 'Hz',
    db: 'dB',
    samples: 'samples',
    channels: 'channels',
    channelMono: 'channel (mono)',
    channelStereo: 'channels (stereo)',
    pascal: 'Pascal',
  },

  // Status & Messages
  status: {
    ready: 'Ready',
    loading: 'Processing...',
    soundCreated: 'Sound created',
    soundRecorded: 'Recorded Sound saved to Objects list',
    soundLoaded: 'Sound loaded from file',
    pitchCalculated: 'Pitch contour extracted',
    formantCalculated: 'Formants extracted',
    spectrogramCalculated: 'Spectrogram calculated',
    intensityCalculated: 'Intensity contour extracted',
    cepstrogramCalculated: 'PowerCepstrogram calculated',
    cppCalculated: 'CPP contour calculated',
    lpcCalculated: 'LPC (burg) calculated',
    mfccCalculated: 'MFCC coefficients extracted',
    klattGridCreated: 'KlattGrid created',
    speakerCreated: 'Speaker created',
    artwordCreated: 'Artword created',
    articulatorySoundSynthesized: 'Articulatory Sound synthesized',
    textGridCreated: 'TextGrid created',
    textGridLoaded: 'TextGrid loaded from file',
    textGridSaved: 'TextGrid saved successfully',
    folderMounted: 'Mounted local folder to /workspace',
    drawnToPicture: 'Drawn to Praat Picture',
    pictureExported: 'Praat Picture exported',
    workspaceSaved: 'Workspace saved to OPFS',
    workspaceRestored: 'Workspace restored from OPFS',
    workspaceCleared: 'Saved OPFS workspace cleared',
    objectRemoved: 'Object removed',
    noSelection: 'No object selected.',
    dragDropPrompt: 'Drag and drop audio files here, or use Open -> Read from file...',
  },

  // Editor Views
  editor: {
    soundEditorTitle: 'Sound Editor',
    textGridEditorTitle: 'TextGrid Editor',
    placeholderNotice: 'Waveform and spectrogram views will be available in Phase 4.',
    closeEditor: 'Close Editor',
    showSpectrogram: 'Show spectrogram',
    showPitch: 'Show pitch',
    showFormants: 'Show formants',
    showIntensity: 'Show intensity',
    greyscale: 'Greyscale',
    colour: 'Colour',
    zoomAll: 'all',
    zoomIn: 'in',
    zoomOut: 'out',
    zoomSel: 'sel',
    zoomBak: 'bak',
    undo: 'undo',
    redo: 'redo',
    visible: 'Visible',
    selection: 'Selection',
    total: 'Total',
    frequencyHz: 'Frequency (Hz)',
    pitchHz: 'Pitch (Hz)',
    intensityDb: 'Intensity (dB)',
    timeSeconds: 'Time (s)',
    channel1: 'Ch 1',
    channel2: 'Ch 2',
    pitchRange: '75 - 500 Hz',
    intensityRange: '50 - 100 dB',
    playSelection: 'Play selection',
    playWindow: 'Play visible',
  },

  // Script Console
  script: {
    title: 'Praat Script',
    run: 'Run',
    running: 'Running...',
    clear: 'Clear',
    clearInfo: 'Clear Info',
    samples: 'Sample scripts...',
    sampleArithmetic: 'Loop & Math calculations',
    sampleProcedures: 'Procedures & Strings',
    sampleVariables: 'Batch Variable Operations',
    samplePicture: 'Praat Picture Drawing',
    openScript: 'Open...',
    saveScript: 'Save...',
    shortcutHint: 'Ctrl+Enter to run',
    scriptCompleted: 'Script executed successfully',
    scriptError: 'Script execution failed',
    untitledScript: 'untitled.praat',
    newScript: 'New',
    newScriptCreated: 'Created new empty Praat script',
    scriptLoaded: 'Loaded script',
    scriptLoadSuccess: 'Praat script loaded successfully:',
    scriptLoadError: 'Failed to load Praat script',
    closeTab: 'Close Script',
    scriptFormTitle: 'Praat Script Form',
    mountFolder: 'Mount folder...',
    mountedFolder: 'Mounted folder',
    useMountedFolder: 'Use mounted folder',
    scriptPaused: 'Script paused',
    scriptResumed: 'Script resumed',
    scriptAborted: 'Script aborted by user',

    // Phase 10 File Sync & Export
    fileSavedToDisk: 'Saved {file} to disk',
    filesSavedToDisk: 'Saved {count} modified files to disk',
    fileDownloaded: 'Downloaded {file}',
    filesReadyForDownload: '{count} files ready for export',
    scriptExportTitle: 'Export Script Outputs',
    scriptExportPrompt: 'The following files were generated or modified during script execution:',
    downloadZip: 'Download All (.zip)',
    downloadFile: 'Download',
    newBadge: 'New',
    modifiedBadge: 'Modified',
    close: 'Close',
    autoSaveStep: 'Auto-saved before continuing to next file',
  },

  // TextGrid Editor Menu Bar & Operations (Phase 8)
  textGridMenu: {
    // Top-level menu headers
    file: 'File',
    edit: 'Edit',
    query: 'Query',
    select: 'Select',
    interval: 'Interval',
    boundary: 'Boundary',
    tier: 'Tier',

    // File menu
    exportTextGrid: 'Save as TextGrid file...',
    closeEditor: 'Close',

    // Edit menu
    undo: 'Undo',
    redo: 'Redo',
    cutText: 'Cut text',
    copyText: 'Copy text',
    pasteText: 'Paste text',

    // Query menu
    getTimeOfCursor: 'Get time of cursor',
    getSelectionStart: 'Get selection start',
    getSelectionEnd: 'Get selection end',
    getSelectionLength: 'Get selection length',
    getIntervalLabel: 'Get label of interval',
    getNumberOfTiers: 'Get number of tiers',
    getNumberOfIntervals: 'Get number of intervals',

    // Select menu
    moveToStart: 'Move cursor to start of selection',
    moveToEnd: 'Move cursor to end of selection',
    selectPreviousInterval: 'Select previous interval',
    selectNextInterval: 'Select next interval',

    // Interval menu
    newIntervalOnTier: 'New interval on tier...',
    removeInterval: 'Remove interval',
    setIntervalText: 'Set interval text...',
    clearText: 'Clear interval text',

    // Boundary menu
    addBoundaryAtCursor: 'Add boundary at cursor on tier...',
    addBoundaryOnAllTiers: 'Add boundary on all tiers',
    removeBoundaryAtCursor: 'Remove boundary at cursor',
    moveBoundaryToCursor: 'Move nearest boundary to cursor',
    boundaryCircleTooltip: 'Click to add boundary at cursor on this tier',
    allTiersCircleTooltip: 'Click to add boundary at cursor on all tiers',

    // Tier menu
    addIntervalTier: 'Add interval tier...',
    addPointTier: 'Add point tier...',
    duplicateTier: 'Duplicate tier...',
    renameTier: 'Rename tier...',
    removeTier: 'Remove tier',

    // Dialogs & Prompts
    newIntervalTitle: 'New interval on tier',
    tierPosition: 'Position (1 = top)',
    targetTier: 'Tier number',
    tierName: 'Tier name',
    newTierName: 'New tier name',
    sourceTier: 'Tier number to duplicate',
    intervalText: 'Interval text',
    pointMark: 'Point mark text',
    confirmRemoveTier: 'Are you sure you want to remove tier "{name}"?',
    cannotRemoveLastTier: 'Cannot remove the only remaining tier.',
    cursorPlacedAt: 'Cursor is at {time} s',
    selectionRange: 'Selection range: {start} s to {end} s (duration: {duration} s)',
    intervalLabelIs: 'Interval label: "{text}"',
    tierCountIs: 'Total tiers: {count}',
    intervalsOnTierCountIs: 'Tier {tier} has {count} intervals',
    noSelectionOrCursor: 'No selection or cursor positioned.',
    noIntervalSelected: 'No interval selected.',
  },
};

export type LocaleDictionary = typeof en;
