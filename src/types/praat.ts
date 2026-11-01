/**
 * Core type definitions for WebPraat objects and application state.
 */

import type { SupportedLocale } from '../config/i18n';

export type PraatId = number;

export interface PraatObject {
  id: PraatId;
  className: string; // "Sound", "Pitch", "TextGrid", "Formant", "Spectrogram", "Intensity", etc.
  name: string;
  selected?: boolean;
  // Cached metadata for quick UI access
  duration?: number;
  sampleRate?: number;
  numChannels?: number;
  numSamples?: number;
  createdAt?: number;
}

export type EditorTabType = 'objects' | 'soundEditor' | 'textGridEditor' | 'picture' | 'script';

export interface EditorTab {
  id: string;
  type: EditorTabType;
  title: string;
  objectId?: PraatId;
  secondaryObjectId?: PraatId; // E.g. TextGrid paired with Sound
}

export type ModalType =
  | 'rename'
  | 'copy'
  | 'pureTone'
  | 'soundToPitch'
  | 'soundToFormantBurg'
  | 'soundToSpectrogram'
  | 'soundToTextGrid'
  | 'soundGetMean'
  | 'pitchGetMean'
  | 'pitchGetValueAtTime'
  | 'about';

export interface ModalState {
  type: ModalType;
  objectId?: PraatId;
  initialValues?: Record<string, any>;
}

// TextGrid Data Structures
export interface TextInterval {
  id?: string;
  xmin: number;
  xmax: number;
  text: string;
}

export interface TextPoint {
  id?: string;
  time: number;
  mark: string;
}

export interface IntervalTier {
  type: 'IntervalTier';
  name: string;
  xmin: number;
  xmax: number;
  intervals: TextInterval[];
}

export interface PointTier {
  type: 'TextTier';
  name: string;
  xmin: number;
  xmax: number;
  points: TextPoint[];
}

export type TextGridTier = IntervalTier | PointTier;

export interface TextGridData {
  xmin: number;
  xmax: number;
  tiers: TextGridTier[];
}

export interface AppState {
  objects: PraatObject[];
  selectedIds: PraatId[];
  infoOutput: string;
  locale: SupportedLocale;
  activeTab: EditorTabType;
  editorSoundId: PraatId | null;
  editorTextGridId: PraatId | null;
  modal: ModalState | null;
}
