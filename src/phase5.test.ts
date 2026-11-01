/**
 * Phase 5 Acceptance Test Suite:
 * Tests the TextGrid Data Structures, C++ Praat WASM bridge for TextGrid,
 * IntervalTier & PointTier manipulation, boundary insertion and movement,
 * Unicode IPA character annotation, .TextGrid file export, parsing & serialization.
 *
 * Acceptance Check (from AGENTS.md):
 * "User can annotate an audio file, add/modify boundaries, and export a valid .TextGrid file readable by desktop Praat."
 */

import { describe, it, expect, beforeAll } from 'vitest';
import praatWorkerApi from './workers/praatWorker';
import {
  createNewTextGrid,
  serializeTextGrid,
  parseTextGrid,
  insertBoundaryInTier,
  moveBoundaryInTier,
  removeBoundaryFromTier,
  setIntervalTextInTier,
} from './utils/textgrid';
import type { IntervalTier, PointTier, TextGridData } from './types/praat';
import { en } from './config/locales/en';
import { ko } from './config/locales/ko';

describe('Phase 5: TextGrid Editor, Annotation, and .TextGrid File I/O', () => {
  let soundId: number;
  let textGridId: number;
  const fs = 44100;
  const duration = 1.0;
  const n = fs * duration;

  beforeAll(async () => {
    const initialized = await praatWorkerApi.init();
    expect(initialized).toBe(true);

    // Create a 1.0s synthetic Sound
    const samples = new Float64Array(n);
    for (let i = 0; i < n; ++i) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / fs);
    }
    soundId = await praatWorkerApi.createSound(samples, n, 1, fs, 'phase5_test_sound');
    expect(soundId).toBeGreaterThan(0);
  });

  describe('C++ Praat WASM TextGrid Creation & Bridge', () => {
    it('creates a TextGrid from Sound with specified interval and point tiers', async () => {
      textGridId = await praatWorkerApi.soundToTextGrid(
        soundId,
        'words phones',
        'phones'
      );
      expect(textGridId).toBeGreaterThan(0);

      const name = await praatWorkerApi.getObjectName(textGridId);
      const className = await praatWorkerApi.getObjectClass(textGridId);
      expect(className).toBe('TextGrid');
      expect(name).toBeTruthy();
    });

    it('extracts TextGrid data structure via JSON bridge', async () => {
      const data = await praatWorkerApi.getTextGridData(textGridId);
      expect(data).toBeDefined();
      expect(data.xmin).toBeCloseTo(0.0, 3);
      expect(data.xmax).toBeCloseTo(1.0, 3);
      expect(data.tiers).toHaveLength(2);

      // Tier 1: IntervalTier ('words')
      expect(data.tiers[0].type).toBe('IntervalTier');
      expect(data.tiers[0].name).toBe('words');
      const wordsTier = data.tiers[0] as IntervalTier;
      expect(wordsTier.intervals).toHaveLength(1);
      expect(wordsTier.intervals[0].xmin).toBeCloseTo(0.0, 3);
      expect(wordsTier.intervals[0].xmax).toBeCloseTo(1.0, 3);
      expect(wordsTier.intervals[0].text).toBe('');

      // Tier 2: PointTier / TextTier ('phones')
      expect(data.tiers[1].type).toBe('TextTier');
      expect(data.tiers[1].name).toBe('phones');
      const phonesTier = data.tiers[1] as PointTier;
      expect(phonesTier.points).toHaveLength(0);
    });

    it('inserts boundaries in an IntervalTier via WASM bridge', async () => {
      // Insert boundary at 0.4s and 0.75s in Tier 1 ('words')
      await praatWorkerApi.textgridInsertBoundary(textGridId, 1, 0.4);
      await praatWorkerApi.textgridInsertBoundary(textGridId, 1, 0.75);

      const data = await praatWorkerApi.getTextGridData(textGridId);
      const wordsTier = data.tiers[0] as IntervalTier;
      expect(wordsTier.intervals).toHaveLength(3);

      expect(wordsTier.intervals[0].xmin).toBeCloseTo(0.0, 3);
      expect(wordsTier.intervals[0].xmax).toBeCloseTo(0.4, 3);

      expect(wordsTier.intervals[1].xmin).toBeCloseTo(0.4, 3);
      expect(wordsTier.intervals[1].xmax).toBeCloseTo(0.75, 3);

      expect(wordsTier.intervals[2].xmin).toBeCloseTo(0.75, 3);
      expect(wordsTier.intervals[2].xmax).toBeCloseTo(1.0, 3);
    });

    it('annotates intervals with Unicode IPA characters', async () => {
      // Set interval 1 to "həˈloʊ", interval 2 to "wɜːld", interval 3 to "ʃ"
      await praatWorkerApi.textgridSetIntervalText(textGridId, 1, 1, 'həˈloʊ');
      await praatWorkerApi.textgridSetIntervalText(textGridId, 1, 2, 'wɜːld');
      await praatWorkerApi.textgridSetIntervalText(textGridId, 1, 3, 'ʃ');

      const data = await praatWorkerApi.getTextGridData(textGridId);
      const wordsTier = data.tiers[0] as IntervalTier;
      expect(wordsTier.intervals[0].text).toBe('həˈloʊ');
      expect(wordsTier.intervals[1].text).toBe('wɜːld');
      expect(wordsTier.intervals[2].text).toBe('ʃ');
    });

    it('inserts and labels points in a PointTier via WASM bridge', async () => {
      // Insert point at 0.25s and 0.6s in Tier 2 ('phones')
      await praatWorkerApi.textgridInsertPoint(textGridId, 2, 0.25, 'p_burst');
      await praatWorkerApi.textgridInsertPoint(textGridId, 2, 0.6, 'v_onset');

      const data = await praatWorkerApi.getTextGridData(textGridId);
      const phonesTier = data.tiers[1] as PointTier;
      expect(phonesTier.points).toHaveLength(2);
      expect(phonesTier.points[0].time).toBeCloseTo(0.25, 3);
      expect(phonesTier.points[0].mark).toBe('p_burst');
      expect(phonesTier.points[1].time).toBeCloseTo(0.6, 3);
      expect(phonesTier.points[1].mark).toBe('v_onset');
    });

    it('exports TextGrid to standard Praat ooTextFile text format', async () => {
      const exportedText = await praatWorkerApi.exportTextGridAsText(textGridId);
      expect(exportedText).toBeTypeOf('string');
      expect(exportedText).toContain('File type = "ooTextFile"');
      expect(exportedText).toContain('Object class = "TextGrid"');
      expect(exportedText).toContain('class = "IntervalTier"');
      expect(exportedText).toContain('name = "words"');
      expect(exportedText).toContain('class = "TextTier"');
      expect(exportedText).toContain('name = "phones"');
      expect(exportedText).toContain('həˈloʊ');
      expect(exportedText).toContain('wɜːld');
      expect(exportedText).toContain('p_burst');
    });

    it('re-imports exported TextGrid file into WASM and preserves all data', async () => {
      const exportedText = await praatWorkerApi.exportTextGridAsText(textGridId);
      const reimportedId = await praatWorkerApi.readTextGridFromText(
        exportedText,
        'reimported_grid'
      );
      expect(reimportedId).toBeGreaterThan(0);

      const reimportedData = await praatWorkerApi.getTextGridData(reimportedId);
      expect(reimportedData.tiers).toHaveLength(2);

      const wordsTier = reimportedData.tiers[0] as IntervalTier;
      expect(wordsTier.intervals).toHaveLength(3);
      expect(wordsTier.intervals[0].text).toBe('həˈloʊ');
      expect(wordsTier.intervals[1].text).toBe('wɜːld');
      expect(wordsTier.intervals[2].text).toBe('ʃ');

      const phonesTier = reimportedData.tiers[1] as PointTier;
      expect(phonesTier.points).toHaveLength(2);
      expect(phonesTier.points[0].mark).toBe('p_burst');
      expect(phonesTier.points[1].mark).toBe('v_onset');

      // Cleanup
      await praatWorkerApi.destroyObject(reimportedId);
    });
  });

  describe('TypeScript TextGrid Parser & Serializer (Long & Short Formats)', () => {
    it('serializes and parses TextGridData round-trip with Unicode IPA text', () => {
      const original: TextGridData = {
        xmin: 0.0,
        xmax: 2.5,
        tiers: [
          {
            type: 'IntervalTier',
            name: 'phonemes',
            xmin: 0.0,
            xmax: 2.5,
            intervals: [
              { id: '1', xmin: 0.0, xmax: 0.8, text: 'kʰ' },
              { id: '2', xmin: 0.8, xmax: 1.6, text: 'æ' },
              { id: '3', xmin: 1.6, xmax: 2.5, text: 't' },
            ],
          },
          {
            type: 'TextTier',
            name: 'events',
            xmin: 0.0,
            xmax: 2.5,
            points: [
              { id: 'p1', time: 0.8, mark: 'release' },
              { id: 'p2', time: 1.6, mark: 'closure' },
            ],
          },
        ],
      };

      const serialized = serializeTextGrid(original);
      expect(serialized).toContain('File type = "ooTextFile"');
      expect(serialized).toContain('kʰ');
      expect(serialized).toContain('æ');

      const parsed = parseTextGrid(serialized);
      expect(parsed.xmin).toBeCloseTo(0.0, 3);
      expect(parsed.xmax).toBeCloseTo(2.5, 3);
      expect(parsed.tiers).toHaveLength(2);

      const intTier = parsed.tiers[0] as IntervalTier;
      expect(intTier.intervals).toHaveLength(3);
      expect(intTier.intervals[0].text).toBe('kʰ');
      expect(intTier.intervals[1].text).toBe('æ');
      expect(intTier.intervals[2].text).toBe('t');

      const ptTier = parsed.tiers[1] as PointTier;
      expect(ptTier.points).toHaveLength(2);
      expect(ptTier.points[0].mark).toBe('release');
      expect(ptTier.points[1].mark).toBe('closure');
    });

    it('parses short format TextGrid files', () => {
      const shortFormat = [
        'File type = "ooTextFile"',
        'Object class = "TextGrid"',
        '',
        '0.0',
        '1.0',
        '<exists>',
        '1',
        '"IntervalTier"',
        '"word"',
        '0.0',
        '1.0',
        '2',
        '0.0',
        '0.4',
        '"hello"',
        '0.4',
        '1.0',
        '"world"',
      ].join('\n');

      const parsed = parseTextGrid(shortFormat);
      expect(parsed.xmin).toBe(0.0);
      expect(parsed.xmax).toBe(1.0);
      expect(parsed.tiers).toHaveLength(1);

      const tier = parsed.tiers[0] as IntervalTier;
      expect(tier.intervals).toHaveLength(2);
      expect(tier.intervals[0].text).toBe('hello');
      expect(tier.intervals[1].text).toBe('world');
    });

    it('manipulates intervals in memory: insert, move, remove, and set text', () => {
      const initial = createNewTextGrid(0.0, 2.0, ['sentence']);
      const tier0 = initial.tiers[0] as IntervalTier;
      expect(tier0.intervals).toHaveLength(1);

      // 1. Insert boundary at 1.0s
      const afterInsert = insertBoundaryInTier(tier0, 1.0);
      expect(afterInsert.intervals).toHaveLength(2);
      expect(afterInsert.intervals[0].xmax).toBe(1.0);
      expect(afterInsert.intervals[1].xmin).toBe(1.0);

      // 2. Set interval texts
      const withText1 = setIntervalTextInTier(afterInsert, 0, 'Part 1');
      const withText2 = setIntervalTextInTier(withText1, 1, 'Part 2');
      expect(withText2.intervals[0].text).toBe('Part 1');
      expect(withText2.intervals[1].text).toBe('Part 2');

      // 3. Move boundary from 1.0s to 1.3s
      const afterMove = moveBoundaryInTier(withText2, 1, 1.3);
      expect(afterMove.intervals[0].xmax).toBe(1.3);
      expect(afterMove.intervals[1].xmin).toBe(1.3);

      // 4. Remove boundary, merging intervals
      const afterRemove = removeBoundaryFromTier(afterMove, 1);
      expect(afterRemove.intervals).toHaveLength(1);
      expect(afterRemove.intervals[0].xmin).toBe(0.0);
      expect(afterRemove.intervals[0].xmax).toBe(2.0);
      expect(afterRemove.intervals[0].text).toContain('Part 1');
      expect(afterRemove.intervals[0].text).toContain('Part 2');
    });
  });

  describe('Phase 5 Localization Verification', () => {
    it('verifies English and Korean translations contain all TextGrid labels', () => {
      // Menu commands
      expect(en.commands.saveAsTextGridFile).toBe('Save as TextGrid file...');
      expect(ko.commands.saveAsTextGridFile).toBe('TextGrid 파일로 저장...');

      // Dynamic actions
      expect(en.actions.soundToTextGrid).toBe('To TextGrid...');
      expect(ko.actions.soundToTextGrid).toBeTruthy();
      expect(en.actions.exportTextGrid).toBe('Export .TextGrid');
      expect(ko.actions.exportTextGrid).toBeTruthy();

      // Dialogs
      expect(en.dialogs.soundToTextGridTitle).toBe('Sound: To TextGrid');
      expect(ko.dialogs.soundToTextGridTitle).toBeTruthy();
      expect(en.dialogs.tierNames).toBe('All tier names');
      expect(ko.dialogs.tierNames).toBeTruthy();
      expect(en.dialogs.pointTiers).toBe('Which of these are point tiers?');
      expect(ko.dialogs.pointTiers).toBeTruthy();

      // Status
      expect(en.status.textGridCreated).toBe('TextGrid created');
      expect(ko.status.textGridCreated).toBeTruthy();
      expect(en.status.textGridLoaded).toBe('TextGrid loaded from file');
      expect(ko.status.textGridLoaded).toBeTruthy();

      // Editor
      expect(en.editor.textGridEditorTitle).toBe('TextGrid Editor');
      expect(ko.editor.textGridEditorTitle).toBeTruthy();
    });
  });
});
