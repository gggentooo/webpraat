/**
 * WASM Bridge and Worker API interfaces for WebPraat.
 */

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
  
  // Pitch queries
  pitchGetMean(pitchId: number, tmin?: number, tmax?: number): Promise<number>;
  pitchGetValueAtTime(pitchId: number, time: number): Promise<number>;
  
  // Audio export
  exportSoundAsWav(soundId: number): Promise<Uint8Array>;
  
  // Scripting
  executeScript(scriptText: string): Promise<string>;
  getInfoOutput(): Promise<string>;
}
