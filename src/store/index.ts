/**
 * Jotai State Store for WebPraat.
 * Centralizes inventory, selection, info window output, locale, and modal dialog state.
 */

import { atom } from 'jotai';
import type {
  PraatId,
  PraatObject,
  EditorTabType,
  ModalState,
  PictureCommand,
  PictureViewport,
  PicturePenSettings,
} from '../types/praat';
import type { ScriptFormInfo, ScriptPauseData, ModifiedVfsFile } from '../types/wasm';
import { defaultLocale, getTranslation, type SupportedLocale } from '../config/i18n';

// Phase 9 Interactive Scripting & Directory Mounting Interfaces
export interface MountedDirectory {
  name: string;
  path: string;
  handle?: any;
  readOnly?: boolean;
}

export interface ScriptFormModalState {
  formInfo: ScriptFormInfo;
  scriptText: string;
}

export interface ScriptPauseState {
  data: ScriptPauseData;
  scriptText: string;
}

// Core State Atoms
export const objectsAtom = atom<PraatObject[]>([]);
export const selectedIdsAtom = atom<PraatId[]>([]);
export const infoOutputAtom = atom<string>('');
export const localeAtom = atom<SupportedLocale>(defaultLocale);
export const activeTabAtom = atom<EditorTabType>('objects');
export const editorSoundIdAtom = atom<PraatId | null>(null);
export const editorTextGridIdAtom = atom<PraatId | null>(null);
export const scriptTextAtom = atom<string>('# Praat script\nwriteInfoLine: "Hello from WebPraat!"\nfor i from 1 to 5\n    appendInfoLine: "Step ", i, ": value = ", i * i\nendfor\n');
export const scriptNameAtom = atom<string>('untitled.praat');
export const scriptRevisionAtom = atom<number>(0);
export const isScriptRunningAtom = atom<boolean>(false);
export const modalAtom = atom<ModalState | null>(null);
export const isProcessingAtom = atom<boolean>(false);
export const statusMessageAtom = atom<string>('');
export const workspaceHydratedAtom = atom<boolean>(false);

// Phase 9 Interactive Scripting & VFS Atoms
export const mountedDirectoryAtom = atom<MountedDirectory | null>(null);
export const scriptFormModalAtom = atom<ScriptFormModalState | null>(null);
export const scriptPauseStateAtom = atom<ScriptPauseState | null>(null);

// Phase 10 Automated File Synchronization & Change Tracking Atoms
export const scriptExportModalAtom = atom<ModifiedVfsFile[] | null>(null);
export type ActiveEditorSaveCallback = () => Promise<boolean>;
export const activeEditorSaveCallbackAtom = atom<ActiveEditorSaveCallback | null>(null);

// Praat Picture Window State Atoms (Phase 7)
export const pictureCommandsAtom = atom<PictureCommand[]>([]);
export const pictureViewportAtom = atom<PictureViewport>({
  x1: 0,
  x2: 6,
  y1: 0,
  y2: 4,
});
export const picturePenAtom = atom<PicturePenSettings>({
  colour: 'Black',
  lineWidth: 1,
  lineType: 'solid',
  fontSize: 12,
  garnish: true,
});

// Derived Atoms
export const selectedObjectsAtom = atom((get) => {
  const objects = get(objectsAtom);
  const selectedIds = get(selectedIdsAtom);
  return objects.filter((obj) => selectedIds.includes(obj.id));
});

export const singleSelectedObjectAtom = atom((get) => {
  const selected = get(selectedObjectsAtom);
  return selected.length === 1 ? selected[0] : null;
});

export const singleSelectedSoundAtom = atom((get) => {
  const single = get(singleSelectedObjectAtom);
  return single && single.className === 'Sound' ? single : null;
});

export const singleSelectedPitchAtom = atom((get) => {
  const single = get(singleSelectedObjectAtom);
  return single && single.className === 'Pitch' ? single : null;
});

export const singleSelectedFormantAtom = atom((get) => {
  const single = get(singleSelectedObjectAtom);
  return single && single.className === 'Formant' ? single : null;
});

export const singleSelectedSpectrogramAtom = atom((get) => {
  const single = get(singleSelectedObjectAtom);
  return single && single.className === 'Spectrogram' ? single : null;
});

export const singleSelectedIntensityAtom = atom((get) => {
  const single = get(singleSelectedObjectAtom);
  return single && single.className === 'Intensity' ? single : null;
});

export const singleSelectedTextGridAtom = atom((get) => {
  const single = get(singleSelectedObjectAtom);
  return single && single.className === 'TextGrid' ? single : null;
});

export const singleSelectedPowerCepstrogramAtom = atom((get) => {
  const single = get(singleSelectedObjectAtom);
  return single && single.className === 'PowerCepstrogram' ? single : null;
});

export const singleSelectedCppAtom = atom((get) => {
  const single = get(singleSelectedObjectAtom);
  return single && single.className === 'CPP' ? single : null;
});

export const singleSelectedLpcAtom = atom((get) => {
  const single = get(singleSelectedObjectAtom);
  return single && single.className === 'LPC' ? single : null;
});

export const singleSelectedMfccAtom = atom((get) => {
  const single = get(singleSelectedObjectAtom);
  return single && single.className === 'MFCC' ? single : null;
});

export const singleSelectedKlattGridAtom = atom((get) => {
  const single = get(singleSelectedObjectAtom);
  return single && single.className === 'KlattGrid' ? single : null;
});

export const soundAndTextGridSelectedAtom = atom((get) => {
  const selected = get(selectedObjectsAtom);
  if (selected.length !== 2) return null;
  const sound = selected.find((o) => o.className === 'Sound');
  const textGrid = selected.find((o) => o.className === 'TextGrid');
  if (sound && textGrid) {
    return { sound, textGrid };
  }
  return null;
});

export const artwordAndSpeakerSelectedAtom = atom((get) => {
  const selected = get(selectedObjectsAtom);
  if (selected.length !== 2) return null;
  const artword = selected.find((o) => o.className === 'Artword');
  const speaker = selected.find((o) => o.className === 'Speaker');
  if (artword && speaker) {
    return { artword, speaker };
  }
  return null;
});

// Translation Derived Atom
export const tAtom = atom((get) => {
  const locale = get(localeAtom);
  return getTranslation(locale);
});
