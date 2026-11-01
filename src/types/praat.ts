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
  | 'soundRecorder'
  | 'soundToPitch'
  | 'soundToFormantBurg'
  | 'soundToSpectrogram'
  | 'soundToIntensity'
  | 'soundToTextGrid'
  | 'soundToPowerCepstrogram'
  | 'powerCepstrogramGetCpps'
  | 'powerCepstrogramToCpp'
  | 'cppGetMean'
  | 'soundToLpcBurg'
  | 'soundToMfcc'
  | 'createKlattGridFromVowel'
  | 'soundToKlattGrid'
  | 'createSpeaker'
  | 'createArtword'
  | 'artwordSpeakerToSound'
  | 'drawObject'
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

// Praat Picture Window Types (Phase 7)
export interface PictureViewport {
  x1: number; // inches [0..12]
  x2: number; // inches [0..12]
  y1: number; // inches [0..12]
  y2: number; // inches [0..12]
}

export type PraatColour =
  | 'Black'
  | 'White'
  | 'Red'
  | 'Green'
  | 'Blue'
  | 'Cyan'
  | 'Magenta'
  | 'Yellow'
  | 'Maroon'
  | 'Lime'
  | 'Navy'
  | 'Teal'
  | 'Purple'
  | 'Olive'
  | 'Silver'
  | 'Grey';

export type PictureLineType = 'solid' | 'dotted' | 'dashed' | 'dash-dotted';

export interface PicturePenSettings {
  colour: PraatColour;
  lineWidth: number;
  lineType: PictureLineType;
  fontSize: number;
  garnish: boolean;
}

export type PicturePrimitiveShape =
  | 'innerBox'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'paintRectangle'
  | 'circle'
  | 'paintCircle'
  | 'text'
  | 'textTop'
  | 'marksBottom'
  | 'marksLeft';

export type PictureCommand =
  | {
      id: string;
      kind: 'waveform';
      viewport: PictureViewport;
      pen: PicturePenSettings;
      title: string;
      tmin: number;
      tmax: number;
      minAmp: number;
      maxAmp: number;
      samples: Float64Array;
      sampleRate: number;
    }
  | {
      id: string;
      kind: 'spectrogram';
      viewport: PictureViewport;
      pen: PicturePenSettings;
      title: string;
      tmin: number;
      tmax: number;
      maxFreq: number;
      dynamicRange: number;
      preemphasis: number;
      colorMap: 'greyscale' | 'colour';
      nx: number;
      ny: number;
      y1: number;
      dy: number;
      z: Float64Array;
    }
  | {
      id: string;
      kind: 'pitch';
      viewport: PictureViewport;
      pen: PicturePenSettings;
      title: string;
      tmin: number;
      tmax: number;
      fmin: number;
      fmax: number;
      x1: number;
      dx: number;
      frequencies: Float64Array;
    }
  | {
      id: string;
      kind: 'formants';
      viewport: PictureViewport;
      pen: PicturePenSettings;
      title: string;
      tmin: number;
      tmax: number;
      maxFreq: number;
      x1: number;
      dx: number;
      maxnFormants: number;
      frequencies: Float64Array;
      speckle: boolean;
    }
  | {
      id: string;
      kind: 'intensity';
      viewport: PictureViewport;
      pen: PicturePenSettings;
      title: string;
      tmin: number;
      tmax: number;
      minDb: number;
      maxDb: number;
      x1: number;
      dx: number;
      values: Float64Array;
    }
  | {
      id: string;
      kind: 'cpp';
      viewport: PictureViewport;
      pen: PicturePenSettings;
      title: string;
      tmin: number;
      tmax: number;
      minDb: number;
      maxDb: number;
      x1: number;
      dx: number;
      values: Float64Array;
    }
  | {
      id: string;
      kind: 'textgrid';
      viewport: PictureViewport;
      pen: PicturePenSettings;
      title: string;
      tmin: number;
      tmax: number;
      data: TextGridData;
    }
  | {
      id: string;
      kind: 'primitive';
      viewport: PictureViewport;
      pen: PicturePenSettings;
      shape: PicturePrimitiveShape;
      coords?: [number, number, number, number];
      worldBounds?: [number, number, number, number];
      text?: string;
      every?: number;
    };

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
