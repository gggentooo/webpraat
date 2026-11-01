/**
 * WASM Bridge and Worker API interfaces for WebPraat.
 */

import type { TextGridData } from './praat';

export interface SoundInfo {
  id: number;
  name: string;
  className: string;
  duration: number;
  sampleRate: number;
  numSamples: number;
  numChannels: number;
}

export interface PitchAnalysisParams {
  timeStep?: number;
  pitchFloor?: number;
  pitchCeiling?: number;
}

export interface FormantAnalysisParams {
  timeStep?: number;
  nFormants?: number;
  maxFormant?: number;
  windowLength?: number;
}

export interface SpectrogramAnalysisParams {
  windowLength?: number;
  maxFreq?: number;
  timeStep?: number;
  windowShape?: number;
}

export interface IntensityAnalysisParams {
  pitchFloor?: number;
  timeStep?: number;
  subtractMean?: boolean;
}

export interface SpectrogramData {
  xmin: number;
  xmax: number;
  nx: number;
  dx: number;
  x1: number;
  ymin: number;
  ymax: number;
  ny: number;
  dy: number;
  y1: number;
  z: Float64Array; // ny * nx row-major power spectral density matrix
}

export interface PitchTrack {
  xmin: number;
  xmax: number;
  nx: number;
  dx: number;
  x1: number;
  ceiling: number;
  frequencies: Float64Array; // nx frequency values in Hz (0.0 = unvoiced)
}

export interface FormantTrack {
  xmin: number;
  xmax: number;
  nx: number;
  dx: number;
  x1: number;
  maxnFormants: number;
  frequencies: Float64Array; // nx * maxnFormants values in Hz
}

export interface IntensityTrack {
  xmin: number;
  xmax: number;
  nx: number;
  dx: number;
  x1: number;
  values: Float64Array; // nx intensity values in dB
}

export interface CppTrack {
  xmin: number;
  xmax: number;
  nx: number;
  dx: number;
  x1: number;
  values: Float64Array; // nx CPP values in dB
}

export interface MfccInfo {
  xmin: number;
  xmax: number;
  nx: number;
  dx: number;
  x1: number;
  maxNumCoefficients: number;
}

export interface PowerCepstrogramParams {
  pitchFloor?: number;
  timeStep?: number;
  maxFreq?: number;
  preEmphasis?: number;
}

export interface CppsQueryParams {
  subtractTrend?: boolean;
  timeAveragingWindow?: number;
  quefrencyAveragingWindow?: number;
  pitchFloor?: number;
  pitchCeiling?: number;
}

export interface LpcAnalysisParams {
  predictionOrder?: number;
  windowLength?: number;
  timeStep?: number;
  preEmphasis?: number;
}

export interface MfccAnalysisParams {
  numCoefficients?: number;
  windowLength?: number;
  timeStep?: number;
  f1Mel?: number;
  fmaxMel?: number;
  dfMel?: number;
}

export interface KlattGridVowelParams {
  name?: string;
  duration?: number;
  f0Start?: number;
  f1?: number;
  b1?: number;
  f2?: number;
  b2?: number;
  f3?: number;
  b3?: number;
  f4?: number;
}

export interface KlattGridFromSoundParams {
  timeStep?: number;
  nFormants?: number;
  maxFormant?: number;
  windowLength?: number;
  pitchFloor?: number;
  pitchCeiling?: number;
}

export interface ImportedPraatObjectInfo {
  id: number;
  className: string;
  name: string;
  duration?: number;
  sampleRate?: number;
  numChannels?: number;
  numSamples?: number;
}

export interface SoundAnalysisResult {
  spectrogram?: SpectrogramData;
  pitch?: PitchTrack;
  formants?: FormantTrack;
  intensity?: IntensityTrack;
}

/**
 * Interface exposed by the Web Worker via Comlink.
 */
export interface PraatWorkerApi {
  init(): Promise<boolean>;
  
  // Sound creation
  createSound(samples: Float64Array, n: number, channels: number, fs: number, name: string): Promise<number>;
  readSoundFromBuffer(buffer: Uint8Array, name: string): Promise<number>;
  
  // Object lifecycle & introspection
  destroyObject(id: number): Promise<void>;
  getObjectCount(): Promise<number>;
  getObjectName(id: number): Promise<string>;
  getObjectClass(id: number): Promise<string>;
  renameObject(id: number, newName: string): Promise<boolean>;
  exportObjectBinary(id: number): Promise<Uint8Array>;
  importObjectBinary(data: Uint8Array, name?: string): Promise<ImportedPraatObjectInfo>;
  
  // Sound queries
  getSoundInfo(soundId: number): Promise<SoundInfo>;
  getSoundChannelSamples(soundId: number, channel: number): Promise<Float64Array>;
  
  // Phonetic analysis
  soundToPitch(soundId: number, params?: PitchAnalysisParams): Promise<number>;
  soundToFormant(soundId: number, params?: FormantAnalysisParams): Promise<number>;
  soundToSpectrogram(soundId: number, params?: SpectrogramAnalysisParams): Promise<number>;
  soundToIntensity(soundId: number, params?: IntensityAnalysisParams): Promise<number>;
  
  // Pitch queries
  pitchGetMean(pitchId: number, tmin?: number, tmax?: number): Promise<number>;
  pitchGetValueAtTime(pitchId: number, time: number): Promise<number>;
  
  // Contour and matrix extraction
  getSpectrogramData(spectroId: number): Promise<SpectrogramData>;
  getPitchTrack(pitchId: number): Promise<PitchTrack>;
  getFormantTrack(formantId: number): Promise<FormantTrack>;
  getIntensityTrack(intensityId: number): Promise<IntensityTrack>;
  
  // High-level combined analysis for SoundEditor
  analyzeSoundForEditor(
    soundId: number,
    options?: {
      spectrogram?: boolean;
      pitch?: boolean;
      formant?: boolean;
      intensity?: boolean;
      spectrogramParams?: SpectrogramAnalysisParams;
      pitchParams?: PitchAnalysisParams;
      formantParams?: FormantAnalysisParams;
      intensityParams?: IntensityAnalysisParams;
    }
  ): Promise<SoundAnalysisResult>;
  
  // TextGrid operations
  createTextGrid(tmin: number, tmax: number, tierNames?: string, pointTiers?: string, name?: string): Promise<number>;
  soundToTextGrid(soundId: number, tierNames?: string, pointTiers?: string): Promise<number>;
  getTextGridData(textgridId: number): Promise<TextGridData>;
  exportTextGridAsText(textgridId: number): Promise<string>;
  readTextGridFromText(content: string, name?: string): Promise<number>;
  textgridInsertBoundary(textgridId: number, tierNumber: number, time: number): Promise<void>;
  textgridRemoveBoundary(textgridId: number, tierNumber: number, time: number): Promise<void>;
  textgridSetIntervalText(textgridId: number, tierNumber: number, intervalNumber: number, text: string): Promise<void>;
  textgridInsertPoint(textgridId: number, tierNumber: number, time: number, mark: string): Promise<void>;
  textgridSetPointText(textgridId: number, tierNumber: number, pointNumber: number, text: string): Promise<void>;

  // Audio export
  exportSoundAsWav(soundId: number): Promise<Uint8Array>;
  
  // Scripting
  executeScript(scriptText: string): Promise<string>;
  getInfoOutput(): Promise<string>;
  clearInfoOutput(): Promise<void>;
  getObjectsJson(): Promise<Array<{ id: number; className: string; name: string; duration?: number; sampleRate?: number; numChannels?: number; numSamples?: number }>>;
  selectObject(id: number): Promise<boolean>;

  // Phase 7 Advanced DSP: Cepstral Peak Prominence (LPC / dwtools)
  soundToPowerCepstrogram(soundId: number, params?: PowerCepstrogramParams): Promise<number>;
  powerCepstrogramGetCpps(cepstrogramId: number, params?: CppsQueryParams): Promise<number>;
  powerCepstrogramToCpp(cepstrogramId: number, pitchFloor?: number, pitchCeiling?: number): Promise<number>;
  soundToCpp(soundId: number, pitchFloor?: number, pitchCeiling?: number, timeStep?: number): Promise<number>;
  cppGetMean(cppId: number, tmin?: number, tmax?: number): Promise<number>;
  getCppTrack(cppId: number): Promise<CppTrack>;

  // Phase 7 Advanced DSP: KlattGrid Speech Synthesis (dwtools)
  createKlattGridFromVowel(params?: KlattGridVowelParams): Promise<number>;
  soundToKlattGrid(soundId: number, params?: KlattGridFromSoundParams): Promise<number>;
  klattGridToSound(klattGridId: number): Promise<number>;

  // Phase 7 Advanced DSP: LPC & MFCC (LPC / dwtools)
  soundToLpcBurg(soundId: number, params?: LpcAnalysisParams): Promise<number>;
  lpcToFormant(lpcId: number): Promise<number>;
  soundToMfcc(soundId: number, params?: MfccAnalysisParams): Promise<number>;
  getMfccInfo(mfccId: number): Promise<MfccInfo>;

  // Phase 7 Advanced DSP: Articulatory Synthesis (artsynth)
  createSpeaker(name?: string, kindOfSpeaker?: string, numVocalCordMasses?: number): Promise<number>;
  createArtword(name?: string, duration?: number, defaultVoiced?: boolean): Promise<number>;
  artwordSetTarget(artwordId: number, muscle: number, time: number, value: number): Promise<void>;
  artwordGetTarget(artwordId: number, muscle: number, time: number): Promise<number>;
  artwordSpeakerToSound(artwordId: number, speakerId: number, sampleRate?: number, oversampling?: number): Promise<number>;
}
