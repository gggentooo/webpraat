/**
 * Phase 3 Acceptance Test Suite:
 * Tests the Application Shell, ObjectsPanel state store, InfoWindow outputs,
 * and localization (English & Korean).
 *
 * Acceptance Check (from AGENTS.md):
 * "User can load a sound, select it, click *To Pitch...*, see `Pitch` object appear
 * in the list, and inspect values in InfoWindow."
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createStore } from 'jotai';
import praatWorkerApi from './workers/praatWorker';
import { createPureTone } from './utils/audio';
import {
  objectsAtom,
  selectedIdsAtom,
  selectedObjectsAtom,
  singleSelectedObjectAtom,
  singleSelectedSoundAtom,
  singleSelectedPitchAtom,
  infoOutputAtom,
  localeAtom,
  tAtom,
} from './store';
import { getTranslation } from './config/i18n';
import { en } from './config/locales/en';
import { ko } from './config/locales/ko';
import type { PraatObject } from './types/praat';

describe('Phase 3: Application Shell, Objects List, InfoWindow & i18n', () => {
  beforeAll(async () => {
    const initialized = await praatWorkerApi.init();
    expect(initialized).toBe(true);
  });

  describe('Localization & System Labels', () => {
    it('provides verbatim Praat English labels', () => {
      expect(en.app.objectsTitle).toBe('Praat Objects');
      expect(en.app.infoTitle).toBe('Praat Info');
      expect(en.app.pictureTitle).toBe('Praat Picture');
      expect(en.menu.praat).toBe('Praat');
      expect(en.menu.new).toBe('New');
      expect(en.menu.open).toBe('Open');
      expect(en.menu.save).toBe('Save');
      expect(en.fixedButtons.rename).toBe('Rename...');
      expect(en.fixedButtons.copy).toBe('Copy...');
      expect(en.fixedButtons.inspect).toBe('Inspect');
      expect(en.fixedButtons.info).toBe('Info');
      expect(en.fixedButtons.remove).toBe('Remove');
      expect(en.actions.viewAndEdit).toBe('View & Edit');
      expect(en.actions.soundToPitch).toBe('To Pitch...');
      expect(en.actions.soundToFormantBurg).toBe('To Formant (burg)...');
      expect(en.actions.soundToSpectrogram).toBe('To Spectrogram...');
      expect(en.actions.getNumSamples).toBe('Get number of samples');
      expect(en.actions.getDuration).toBe('Get total duration');
      expect(en.actions.getSampleRate).toBe('Get sampling frequency');
    });

    it('provides complete Korean translations for all labels', () => {
      // Ensure all top-level keys in en have matching keys in ko
      const enSections = Object.keys(en) as (keyof typeof en)[];
      for (const section of enSections) {
        expect(ko[section]).toBeDefined();
        const enKeys = Object.keys(en[section]);
        const koKeys = Object.keys(ko[section]);
        expect(koKeys.length).toBe(enKeys.length);
        for (const k of enKeys) {
          expect((ko[section] as any)[k]).toBeDefined();
          expect(typeof (ko[section] as any)[k]).toBe('string');
          expect((ko[section] as any)[k].length).toBeGreaterThan(0);
        }
      }

      // Check specific Korean phonetic translations
      expect(ko.app.infoTitle).toBe('Praat 정보 (Info)');
      expect(ko.actions.soundToPitch).toBe('피치 추출 (To Pitch)...');
      expect(ko.actions.soundToFormantBurg).toBe('포먼트 분석 (Burg)...');
      expect(ko.actions.soundToSpectrogram).toBe('스펙트로그램 생성...');
      expect(ko.fixedButtons.rename).toBe('이름 변경...');
      expect(ko.fixedButtons.remove).toBe('제거 (Remove)');
    });

    it('switches translations dynamically via localeAtom', () => {
      expect(getTranslation('en').app.title).toBe('WebPraat');
      expect(getTranslation('ko').app.title).toBe('WebPraat (웹프랏)');

      const store = createStore();
      expect(store.get(localeAtom)).toBe('en');
      expect(store.get(tAtom).app.infoTitle).toBe('Praat Info');

      store.set(localeAtom, 'ko');
      expect(store.get(localeAtom)).toBe('ko');
      expect(store.get(tAtom).app.infoTitle).toBe('Praat 정보 (Info)');

      store.set(localeAtom, 'en');
      expect(store.get(tAtom).app.infoTitle).toBe('Praat Info');
    });
  });

  describe('ObjectsPanel State Store & Selection', () => {
    it('manages object inventory and selection atoms', () => {
      const store = createStore();
      expect(store.get(objectsAtom)).toEqual([]);
      expect(store.get(selectedIdsAtom)).toEqual([]);
      expect(store.get(selectedObjectsAtom)).toEqual([]);
      expect(store.get(singleSelectedObjectAtom)).toBeNull();

      const obj1: PraatObject = {
        id: 1,
        className: 'Sound',
        name: 'test_tone',
        duration: 1.0,
        sampleRate: 44100,
        numChannels: 1,
        numSamples: 44100,
      };
      const obj2: PraatObject = {
        id: 2,
        className: 'Pitch',
        name: 'test_tone_pitch',
      };

      store.set(objectsAtom, [obj1, obj2]);
      expect(store.get(objectsAtom).length).toBe(2);

      // Select obj1
      store.set(selectedIdsAtom, [1]);
      expect(store.get(selectedObjectsAtom)).toEqual([obj1]);
      expect(store.get(singleSelectedObjectAtom)).toEqual(obj1);
      expect(store.get(singleSelectedSoundAtom)).toEqual(obj1);
      expect(store.get(singleSelectedPitchAtom)).toBeNull();

      // Select obj2
      store.set(selectedIdsAtom, [2]);
      expect(store.get(singleSelectedSoundAtom)).toBeNull();
      expect(store.get(singleSelectedPitchAtom)).toEqual(obj2);

      // Multi-select
      store.set(selectedIdsAtom, [1, 2]);
      expect(store.get(selectedObjectsAtom).length).toBe(2);
      expect(store.get(singleSelectedObjectAtom)).toBeNull();
    });
  });

  describe('Acceptance Check: Load Sound -> To Pitch -> Inspect in InfoWindow', () => {
    it('creates a Sound, performs To Pitch analysis, registers Pitch object, and writes query to InfoWindow', async () => {
      const store = createStore();

      // 1. Create a 440 Hz pure tone Sound via worker
      const toneInfo = await createPureTone(praatWorkerApi, 440.0, 1.0, 44100, 0.5, 'tone_sine440');
      expect(toneInfo.id).toBeGreaterThan(0);
      expect(toneInfo.name).toBe('tone_sine440');
      expect(toneInfo.className).toBe('Sound');
      expect(toneInfo.numSamples).toBe(44100);

      // Register in state store
      const soundObj: PraatObject = {
        id: toneInfo.id,
        className: 'Sound',
        name: toneInfo.name,
        duration: toneInfo.duration,
        sampleRate: toneInfo.sampleRate,
        numChannels: toneInfo.numChannels,
        numSamples: toneInfo.numSamples,
        createdAt: Date.now(),
      };
      store.set(objectsAtom, [soundObj]);
      store.set(selectedIdsAtom, [soundObj.id]);

      expect(store.get(singleSelectedSoundAtom)).toEqual(soundObj);

      // 2. Click "To Pitch..." (Simulate analysis call with standard parameters)
      const pitchId = await praatWorkerApi.soundToPitch(soundObj.id, {
        timeStep: 0.0,
        pitchFloor: 75.0,
        pitchCeiling: 600.0,
      });
      expect(pitchId).toBeGreaterThan(0);
      expect(pitchId).not.toBe(soundObj.id);

      const pitchClassName = await praatWorkerApi.getObjectClass(pitchId);
      const pitchName = await praatWorkerApi.getObjectName(pitchId);
      expect(pitchClassName).toBe('Pitch');
      expect(pitchName).toBe('tone_sine440_pitch');

      // 3. Verify Pitch object appears in list and is selected
      const pitchObj: PraatObject = {
        id: pitchId,
        className: pitchClassName,
        name: pitchName,
        createdAt: Date.now(),
      };
      store.set(objectsAtom, [...store.get(objectsAtom), pitchObj]);
      store.set(selectedIdsAtom, [pitchId]);

      expect(store.get(objectsAtom).length).toBe(2);
      expect(store.get(objectsAtom)[1]).toEqual(pitchObj);
      expect(store.get(singleSelectedPitchAtom)).toEqual(pitchObj);

      // 4. Inspect values in InfoWindow
      // Query 1: Pitch -> Get mean...
      const meanF0 = await praatWorkerApi.pitchGetMean(pitchId, 0.0, 0.0);
      expect(meanF0).toBeCloseTo(440.0, 1);
      const queryOutput1 = `${meanF0.toFixed(2)} Hertz\n`;
      store.set(infoOutputAtom, (prev) => prev + queryOutput1);

      // Query 2: Pitch -> Get value at time...
      const valAt05 = await praatWorkerApi.pitchGetValueAtTime(pitchId, 0.5);
      expect(valAt05).toBeCloseTo(440.0, 1);
      const queryOutput2 = `${valAt05.toFixed(2)} Hertz (at 0.5 seconds)\n`;
      store.set(infoOutputAtom, (prev) => prev + queryOutput2);

      // Query 3: General Object Info
      const generalInfo = [
        `Object id: ${pitchObj.id}`,
        `Object type: ${pitchObj.className}`,
        `Object name: ${pitchObj.name}`,
        '',
      ].join('\n');
      store.set(infoOutputAtom, (prev) => prev + generalInfo);

      // 5. Verify the formatted output in InfoWindow
      const finalInfo = store.get(infoOutputAtom);
      expect(finalInfo).toContain('440.00 Hertz');
      expect(finalInfo).toContain('440.00 Hertz (at 0.5 seconds)');
      expect(finalInfo).toContain(`Object id: ${pitchObj.id}`);
      expect(finalInfo).toContain('Object type: Pitch');
      expect(finalInfo).toContain('Object name: tone_sine440_pitch');

      // 6. Test Clear InfoWindow
      store.set(infoOutputAtom, '');
      expect(store.get(infoOutputAtom)).toBe('');

      // 7. Clean up objects
      await praatWorkerApi.destroyObject(soundObj.id);
      await praatWorkerApi.destroyObject(pitchObj.id);
      store.set(objectsAtom, []);
      store.set(selectedIdsAtom, []);
      expect(store.get(objectsAtom).length).toBe(0);
    });
  });
});
