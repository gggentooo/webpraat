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
    newPraatScript: 'New Praat script',
    openPraatScript: 'Open Praat script...',
    clearInfo: 'Clear Info',
    
    // New menu
    recordMonoSound: 'Record mono Sound...',
    recordStereoSound: 'Record stereo Sound...',
    createSoundAsPureTone: 'Create Sound as pure tone...',
    
    // Open menu
    readFromFile: 'Read from file...',
    openLongSoundFile: 'Open long sound file...',
    
    // Save menu
    saveAsWavFile: 'Save as WAV file...',
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
    query: 'Query -',
    
    // Sound Actions
    soundToPitch: 'To Pitch...',
    soundToFormantBurg: 'To Formant (burg)...',
    soundToSpectrogram: 'To Spectrogram...',
    soundToIntensity: 'To Intensity...',
    soundToTextGrid: 'To TextGrid...',
    
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
    soundLoaded: 'Sound loaded from file',
    pitchCalculated: 'Pitch contour extracted',
    formantCalculated: 'Formants extracted',
    spectrogramCalculated: 'Spectrogram calculated',
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
  },
};

export type LocaleDictionary = typeof en;
