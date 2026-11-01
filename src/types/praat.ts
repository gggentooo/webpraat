/**
 * Core type definitions for WebPraat objects and application state.
 */

import type { SupportedLocale } from '../config/i18n';

export type PraatId = number;

export interface PraatObject {
  id: PraatId;
  className: string; // "Sound", "Pitch", "TextGrid", "Formant", "Spectrogram", etc.
  name: string;
  selected?: boolean;
  // Cached metadata for quick UI access
  duration?: number;
  sampleRate?: number;
  numChannels?: number;
  numSamples?: number;
  createdAt?: number;
}

export type EditorTabType = 'objects' | 'soundEditor' | 'textGridEditor' | 'picture';

export interface EditorTab {
  id: string;
  type: EditorTabType;
  title: string;
  objectId?: PraatId;
}

export type ModalType =
  | 'rename'
  | 'copy'
  | 'pureTone'
  | 'soundToPitch'
  | 'soundToFormantBurg'
  | 'soundToSpectrogram'
  | 'soundGetMean'
  | 'pitchGetMean'
  | 'pitchGetValueAtTime'
  | 'about';

export interface ModalState {
  type: ModalType;
  objectId?: PraatId;
  initialValues?: Record<string, any>;
}

export interface AppState {
  objects: PraatObject[];
  selectedIds: PraatId[];
  infoOutput: string;
  locale: SupportedLocale;
  activeTab: EditorTabType;
  editorSoundId: PraatId | null;
  modal: ModalState | null;
}
