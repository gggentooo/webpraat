/**
 * WASM Bridge API interfaces for WebPraat.
 */

export interface PraatWasmModule {
  // Object lifecycle
  praat_createSound(samplesPtr: number, n: number, channels: number, fs: number): number;
  praat_destroyObject(id: number): void;
  praat_getObjectCount(): number;
  praat_getObjectName(id: number): string;
  praat_getObjectClass(id: number): string;

  // Analysis hooks
  praat_soundToPitch(soundId: number, timeStep: number, minPitch: number, maxPitch: number): number;
  praat_soundToFormant(soundId: number, timeStep: number, nFormants: number, maxFormant: number, windowLength: number): number;
  praat_soundToSpectrogram(soundId: number, windowLength: number, maxFreq: number, timeStep: number, windowShape: number): number;

  // Data queries
  praat_pitchGetMean(pitchId: number, tmin: number, tmax: number): number;
  praat_spectrogramGetMatrix(spectroId: number, nrowsPtr: number, ncolsPtr: number): number;

  // Script execution & Info output
  praat_executeScript(scriptText: string): string;
  praat_getInfoOutput(): string;
}
