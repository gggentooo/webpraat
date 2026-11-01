/**
 * Jotai State Store for WebPraat.
 * Centralizes inventory, selection, info window output, locale, and modal dialog state.
 */

import { atom } from 'jotai';
import type { PraatId, PraatObject, EditorTabType, ModalState } from '../types/praat';
import { defaultLocale, getTranslation, type SupportedLocale } from '../config/i18n';

// Core State Atoms
export const objectsAtom = atom<PraatObject[]>([]);
export const selectedIdsAtom = atom<PraatId[]>([]);
export const infoOutputAtom = atom<string>('');
export const localeAtom = atom<SupportedLocale>(defaultLocale);
export const activeTabAtom = atom<EditorTabType>('objects');
export const editorSoundIdAtom = atom<PraatId | null>(null);
export const modalAtom = atom<ModalState | null>(null);
export const isProcessingAtom = atom<boolean>(false);
export const statusMessageAtom = atom<string>('');

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

// Translation Derived Atom
export const tAtom = atom((get) => {
  const locale = get(localeAtom);
  return getTranslation(locale);
});
