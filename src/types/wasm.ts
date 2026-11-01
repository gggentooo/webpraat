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
}
