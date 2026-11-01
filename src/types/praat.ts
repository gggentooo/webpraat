/**
 * Core type definitions for WebPraat objects and application state.
 */

export type PraatId = number;

export interface PraatObject {
  id: PraatId;
  className: string; // "Sound", "Pitch", "TextGrid", "Formant", "Spectrogram", etc.
  name: string;
  selected: boolean;
}

export interface AppState {
  objects: PraatObject[];
  selectedIds: PraatId[];
  infoOutput: string;
}
