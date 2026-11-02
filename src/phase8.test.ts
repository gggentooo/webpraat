/**
 * Phase 8 Acceptance Test Suite:
 * Tests the Advanced TextGrid Annotation & Editor Menus,
 * C++ WASM bridge tier management (add, remove, duplicate, rename),
 * Interval operations (new interval on tier across time range, remove interval),
 * Boundary operations at cursor time across single tier and all tiers,
 * Serialization round-trip for desktop Praat parity,
 * and 100% key parity in localization.
 *
 * Acceptance Check (from AGENTS.md):
 * "User can select an audio time range, click Interval > New interval on tier...
 * (or press Enter / click the cursor circle) to create new intervals,
 * add/remove/rename tiers, and export the resulting .TextGrid file with
 * identical structure in desktop Praat."
 */

import { describe, it, expect, beforeAll } from 'vitest';
import praatWorkerApi from './workers/praatWorker';
import {
  createNewTextGrid,
  serializeTextGrid,
  parseTextGrid,
  insertBoundaryInTier,
  insertIntervalOnTier,
  removeIntervalFromTier,
  addIntervalTierToGrid,
  addPointTierToGrid,
  duplicateTierInGrid,
  renameTierInGrid,
  removeTierFromGrid,
} from './utils/textgrid';
import type { IntervalTier, PointTier } from './types/praat';
import { en } from './config/locales/en';
import { ko } from './config/locales/ko';

describe('Phase 8: Advanced TextGrid Annotation, Editor Menus & Tier Management', () => {
  let soundId: number;
  let textGridId: number;
  const fs = 44100;
  const duration = 2.0;
  const n = fs * duration;

  beforeAll(async () => {
    const initialized = await praatWorkerApi.init();
    expect(initialized).toBe(true);

    // Create a 2.0s synthetic Sound
    const samples = new Float64Array(n);
    for (let i = 0; i < n; ++i) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / fs);
    }
    soundId = await praatWorkerApi.createSound(samples, n, 1, fs, 'phase8_test_sound');
    expect(soundId).toBeGreaterThan(0);

    // Create a base TextGrid with 1 interval tier
    textGridId = await praatWorkerApi.soundToTextGrid(soundId, 'sentence', '');
    expect(textGridId).toBeGreaterThan(0);
  });

  describe('1. C++ WASM Bridge Tier Management', () => {
    it('adds an interval tier at specified position in C++ TextGrid', async () => {
      // Add interval tier 'words' at position 2
      await praatWorkerApi.textgridAddTier(textGridId, 2, 'words', true);

      const data = await praatWorkerApi.getTextGridData(textGridId);
      expect(data.tiers.length).toBe(2);
      expect(data.tiers[1].name).toBe('words');
      expect(data.tiers[1].type).toBe('IntervalTier');
    });

    it('adds a point tier at specified position in C++ TextGrid', async () => {
      // Add point tier 'events' at position 3
      await praatWorkerApi.textgridAddTier(textGridId, 3, 'events', false);

      const data = await praatWorkerApi.getTextGridData(textGridId);
      expect(data.tiers.length).toBe(3);
      expect(data.tiers[2].name).toBe('events');
      expect(data.tiers[2].type).toBe('TextTier');
    });

    it('renames a tier in C++ TextGrid', async () => {
      await praatWorkerApi.textgridRenameTier(textGridId, 2, 'phrases');
      const data = await praatWorkerApi.getTextGridData(textGridId);
      expect(data.tiers[1].name).toBe('phrases');
    });

    it('duplicates a tier in C++ TextGrid', async () => {
      // Duplicate tier 1 ('sentence') to position 2 with name 'sentence_backup'
      await praatWorkerApi.textgridDuplicateTier(textGridId, 1, 2, 'sentence_backup');

      const data = await praatWorkerApi.getTextGridData(textGridId);
      expect(data.tiers.length).toBe(4);
      expect(data.tiers[1].name).toBe('sentence_backup');
    });

    it('removes a tier from C++ TextGrid', async () => {
      // Remove the duplicated tier at position 2
      await praatWorkerApi.textgridRemoveTier(textGridId, 2);

      const data = await praatWorkerApi.getTextGridData(textGridId);
      expect(data.tiers.length).toBe(3);
      expect(data.tiers[1].name).toBe('phrases');
    });

    it('refuses to remove the last remaining tier in C++ TextGrid', async () => {
      // Create a temporary 1-tier TextGrid
      const tempTg = await praatWorkerApi.soundToTextGrid(soundId, 'single', '');
      const initialData = await praatWorkerApi.getTextGridData(tempTg);
      expect(initialData.tiers.length).toBe(1);

      // Attempting to remove the last tier should reject safely
      await expect(praatWorkerApi.textgridRemoveTier(tempTg, 1)).rejects.toThrow();

      // Ensure tier was not deleted
      const finalData = await praatWorkerApi.getTextGridData(tempTg);
      expect(finalData.tiers.length).toBe(1);
      await praatWorkerApi.destroyObject(tempTg);
    });
  });

  describe('2. In-Memory Data Model Operations (Intervals & Tiers)', () => {
    it('creates intervals across a selected time range with insertIntervalOnTier', () => {
      let grid = createNewTextGrid(0.0, 2.0, ['words']);
      let tier = grid.tiers[0] as IntervalTier;
      expect(tier.intervals.length).toBe(1);

      // Insert interval [0.4, 0.9] with text 'hello'
      const { updatedTier, newIntervalIndex } = insertIntervalOnTier(
        tier,
        0.4,
        0.9,
        'hello'
      );
      expect(updatedTier.intervals.length).toBe(3);
      expect(newIntervalIndex).toBe(1);

      const targetInt = updatedTier.intervals[newIntervalIndex];
      expect(targetInt.xmin).toBeCloseTo(0.4, 4);
      expect(targetInt.xmax).toBeCloseTo(0.9, 4);
      expect(targetInt.text).toBe('hello');

      // Surrounding intervals
      expect(updatedTier.intervals[0].xmin).toBeCloseTo(0.0, 4);
      expect(updatedTier.intervals[0].xmax).toBeCloseTo(0.4, 4);
      expect(updatedTier.intervals[2].xmin).toBeCloseTo(0.9, 4);
      expect(updatedTier.intervals[2].xmax).toBeCloseTo(2.0, 4);
    });

    it('removes an interval and merges with adjacent intervals', () => {
      let grid = createNewTextGrid(0.0, 2.0, ['words']);
      let tier = grid.tiers[0] as IntervalTier;
      const { updatedTier } = insertIntervalOnTier(tier, 0.5, 1.2, 'test');
      expect(updatedTier.intervals.length).toBe(3);

      // Remove interval 1
      const mergedTier = removeIntervalFromTier(updatedTier, 1);
      expect(mergedTier.intervals.length).toBe(2);
      expect(mergedTier.intervals[0].xmax).toBeCloseTo(1.2, 4);
    });

    it('adds interval and point tiers to grid data structure', () => {
      let grid = createNewTextGrid(0.0, 2.0, ['tier1']);
      expect(grid.tiers.length).toBe(1);

      grid = addIntervalTierToGrid(grid, 2, 'tier2');
      expect(grid.tiers.length).toBe(2);
      expect(grid.tiers[1].name).toBe('tier2');
      expect(grid.tiers[1].type).toBe('IntervalTier');

      grid = addPointTierToGrid(grid, 3, 'points');
      expect(grid.tiers.length).toBe(3);
      expect(grid.tiers[2].name).toBe('points');
      expect(grid.tiers[2].type).toBe('TextTier');
    });

    it('duplicates, renames, and removes tiers in grid data structure', () => {
      let grid = createNewTextGrid(0.0, 2.0, ['base']);
      let baseTier = grid.tiers[0] as IntervalTier;
      const { updatedTier } = insertIntervalOnTier(baseTier, 0.2, 0.8, 'label');
      grid.tiers[0] = updatedTier;

      // Duplicate tier 0 to position 2
      grid = duplicateTierInGrid(grid, 0, 2, 'base_copy');
      expect(grid.tiers.length).toBe(2);
      expect(grid.tiers[1].name).toBe('base_copy');
      expect((grid.tiers[1] as IntervalTier).intervals.length).toBe(3);
      expect((grid.tiers[1] as IntervalTier).intervals[1].text).toBe('label');

      // Rename tier 1
      grid = renameTierInGrid(grid, 1, 'renamed_tier');
      expect(grid.tiers[1].name).toBe('renamed_tier');

      // Remove tier 0
      grid = removeTierFromGrid(grid, 0);
      expect(grid.tiers.length).toBe(1);
      expect(grid.tiers[0].name).toBe('renamed_tier');
    });
  });

  describe('3. Multi-tier Boundary Operations at Cursor Time', () => {
    it('adds boundaries at cursor time across all interval tiers', () => {
      let grid = createNewTextGrid(0.0, 2.0, ['tierA', 'tierB']);
      const cursorTime = 0.75;

      const updatedTiers = grid.tiers.map((tier) => {
        if (tier.type === 'IntervalTier') {
          return insertBoundaryInTier(tier as IntervalTier, cursorTime);
        }
        return tier;
      });

      const newGrid = { ...grid, tiers: updatedTiers };
      expect((newGrid.tiers[0] as IntervalTier).intervals.length).toBe(2);
      expect((newGrid.tiers[1] as IntervalTier).intervals.length).toBe(2);
      expect((newGrid.tiers[0] as IntervalTier).intervals[0].xmax).toBeCloseTo(0.75, 4);
      expect((newGrid.tiers[1] as IntervalTier).intervals[0].xmax).toBeCloseTo(0.75, 4);
    });
  });

  describe('4. TextGrid Serialization & Round-trip Parity', () => {
    it('serializes multi-tier TextGrid to standard Praat format and round-trips accurately', () => {
      let grid = createNewTextGrid(0.0, 2.5, ['sentence', 'words']);
      grid = addPointTierToGrid(grid, 3, 'phones');

      // Annotate intervals & points
      const t1 = grid.tiers[0] as IntervalTier;
      const { updatedTier: t1New } = insertIntervalOnTier(t1, 0.3, 1.8, 'a full sentence');
      grid.tiers[0] = t1New;

      const t2 = grid.tiers[1] as IntervalTier;
      const { updatedTier: t2New } = insertIntervalOnTier(t2, 0.3, 0.7, 'hello');
      grid.tiers[1] = t2New;

      const ptTier = grid.tiers[2] as PointTier;
      ptTier.points.push({ id: 'p1', time: 0.5, mark: 'h' });
      ptTier.points.push({ id: 'p2', time: 1.0, mark: 'e' });

      const serialized = serializeTextGrid(grid);
      expect(serialized).toContain('File type = "ooTextFile"');
      expect(serialized).toContain('Object class = "TextGrid"');
      expect(serialized).toContain('size = 3');
      expect(serialized).toContain('"a full sentence"');
      expect(serialized).toContain('"hello"');

      // Parse back via TypeScript parser
      const parsed = parseTextGrid(serialized);
      expect(parsed.tiers.length).toBe(3);
      expect(parsed.tiers[0].name).toBe('sentence');
      expect(parsed.tiers[1].name).toBe('words');
      expect(parsed.tiers[2].name).toBe('phones');
      expect((parsed.tiers[0] as IntervalTier).intervals[1].text).toBe('a full sentence');
      expect((parsed.tiers[1] as IntervalTier).intervals[1].text).toBe('hello');
      expect((parsed.tiers[2] as PointTier).points.length).toBe(2);
    });
  });

  describe('5. Localization Key Parity (English vs Korean)', () => {
    it('maintains 100% key parity between en and ko for all textGridMenu entries', () => {
      const enKeys = Object.keys(en.textGridMenu).sort();
      const koKeys = Object.keys(ko.textGridMenu).sort();

      expect(koKeys).toEqual(enKeys);
      expect(enKeys.length).toBeGreaterThanOrEqual(30);

      // Verify essential Phase 8 keys exist and are non-empty
      const essentialKeys = [
        'file',
        'edit',
        'query',
        'select',
        'interval',
        'boundary',
        'tier',
        'newIntervalOnTier',
        'removeInterval',
        'setIntervalText',
        'addBoundaryAtCursor',
        'addBoundaryOnAllTiers',
        'removeBoundaryAtCursor',
        'moveBoundaryToCursor',
        'addIntervalTier',
        'addPointTier',
        'duplicateTier',
        'renameTier',
        'removeTier',
        'newIntervalTitle',
        'tierPosition',
        'targetTier',
        'tierName',
        'newTierName',
        'sourceTier',
        'intervalText',
        'confirmRemoveTier',
        'cannotRemoveLastTier',
        'noIntervalSelected',
      ];

      for (const k of essentialKeys) {
        expect((en.textGridMenu as any)[k]).toBeTruthy();
        expect((ko.textGridMenu as any)[k]).toBeTruthy();
      }
    });

    it('ensures overall locale dictionaries have 100% key parity across all sections', () => {
      const enSections = Object.keys(en).sort();
      const koSections = Object.keys(ko).sort();
      expect(koSections).toEqual(enSections);

      for (const sec of enSections) {
        const enSecKeys = Object.keys((en as any)[sec]).sort();
        const koSecKeys = Object.keys((ko as any)[sec]).sort();
        expect(koSecKeys).toEqual(enSecKeys);
      }
    });
  });
});
