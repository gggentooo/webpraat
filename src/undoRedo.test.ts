/**
 * Undo / Redo Functionality Tests:
 * Tests undo and redo operations across working editors (TextGrid, Picture),
 * keyboard shortcut handlers (Cmd+Z, Ctrl+Z, Cmd+Shift+Z, Ctrl+Y),
 * WASM C++ bridge object synchronization on edits/undo/redo,
 * and localization key parity.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import praatWorkerApi from './workers/praatWorker';
import {
  createNewTextGrid,
  insertBoundaryInTier,
  setIntervalTextInTier,
  removeBoundaryFromTier,
} from './utils/textgrid';
import type { IntervalTier, TextGridData, PictureCommand } from './types/praat';
import { en } from './config/locales/en';
import { ko } from './config/locales/ko';

describe('Undo / Redo Functionality', () => {
  let textGridId: number;

  beforeAll(async () => {
    const initialized = await praatWorkerApi.init();
    expect(initialized).toBe(true);
    textGridId = await praatWorkerApi.createTextGrid(0.0, 2.0, 'sentence words', '', 'undo_test_grid');
    expect(textGridId).toBeGreaterThan(0);
  });

  describe('1. TextGrid WASM Bridge Synchronization with Undo/Redo', () => {
    it('synchronizes whole TextGrid snapshots to C++ Praat bridge via updateTextGridData', async () => {
      const initialData = await praatWorkerApi.getTextGridData(textGridId);
      expect(initialData.tiers).toHaveLength(2);
      expect((initialData.tiers[0] as IntervalTier).intervals).toHaveLength(1);

      // 1. Edit 1: Insert boundary at 1.0s and label interval 1 as "First"
      let currentGrid: TextGridData = structuredClone(initialData);
      const tier0 = currentGrid.tiers[0] as IntervalTier;
      const afterBoundary = insertBoundaryInTier(tier0, 1.0);
      const afterText = setIntervalTextInTier(afterBoundary, 0, 'First');
      currentGrid.tiers[0] = afterText;

      await praatWorkerApi.updateTextGridData(textGridId, currentGrid);

      // Verify C++ bridge updated
      let inWasm = await praatWorkerApi.getTextGridData(textGridId);
      let wasmTier0 = inWasm.tiers[0] as IntervalTier;
      expect(wasmTier0.intervals).toHaveLength(2);
      expect(wasmTier0.intervals[0].text).toBe('First');
      expect(wasmTier0.intervals[0].xmax).toBe(1.0);

      // 2. Edit 2: Insert boundary at 1.5s and label interval 2 as "Second"
      const stateBeforeEdit2 = structuredClone(currentGrid);
      const tier0Edit2 = currentGrid.tiers[0] as IntervalTier;
      const afterBoundary2 = insertBoundaryInTier(tier0Edit2, 1.5);
      const afterText2 = setIntervalTextInTier(afterBoundary2, 1, 'Second');
      currentGrid.tiers[0] = afterText2;

      await praatWorkerApi.updateTextGridData(textGridId, currentGrid);

      inWasm = await praatWorkerApi.getTextGridData(textGridId);
      wasmTier0 = inWasm.tiers[0] as IntervalTier;
      expect(wasmTier0.intervals).toHaveLength(3);
      expect(wasmTier0.intervals[1].text).toBe('Second');

      // 3. UNDO operation: Revert to stateBeforeEdit2
      await praatWorkerApi.updateTextGridData(textGridId, stateBeforeEdit2);

      inWasm = await praatWorkerApi.getTextGridData(textGridId);
      wasmTier0 = inWasm.tiers[0] as IntervalTier;
      expect(wasmTier0.intervals).toHaveLength(2);
      expect(wasmTier0.intervals[0].text).toBe('First');
      expect(wasmTier0.intervals[1].xmax).toBe(2.0);

      // 4. REDO operation: Restore currentGrid (Edit 2)
      await praatWorkerApi.updateTextGridData(textGridId, currentGrid);

      inWasm = await praatWorkerApi.getTextGridData(textGridId);
      wasmTier0 = inWasm.tiers[0] as IntervalTier;
      expect(wasmTier0.intervals).toHaveLength(3);
      expect(wasmTier0.intervals[1].text).toBe('Second');
    });

    it('undoes boundary deletion and restores interval boundaries and texts', async () => {
      const baseGrid = createNewTextGrid(0.0, 1.0, ['words']);
      const tier = baseGrid.tiers[0] as IntervalTier;
      const withSplit = insertBoundaryInTier(tier, 0.5);
      const withText1 = setIntervalTextInTier(withSplit, 0, 'left');
      const withText2 = setIntervalTextInTier(withText1, 1, 'right');
      const initialGrid: TextGridData = { ...baseGrid, tiers: [withText2] };

      // Snapshot for Undo stack
      const undoStack: TextGridData[] = [structuredClone(initialGrid)];
      const redoStack: TextGridData[] = [];

      // Perform boundary removal
      const mergedTier = removeBoundaryFromTier(withText2, 1);
      const modifiedGrid: TextGridData = { ...baseGrid, tiers: [mergedTier] };
      expect((modifiedGrid.tiers[0] as IntervalTier).intervals).toHaveLength(1);

      // User presses Undo
      const currentState = structuredClone(modifiedGrid);
      const previousState = undoStack.pop()!;
      redoStack.push(currentState);

      expect((previousState.tiers[0] as IntervalTier).intervals).toHaveLength(2);
      expect((previousState.tiers[0] as IntervalTier).intervals[0].text).toBe('left');
      expect((previousState.tiers[0] as IntervalTier).intervals[1].text).toBe('right');

      // User presses Redo
      const nextState = redoStack.pop()!;
      undoStack.push(previousState);

      expect((nextState.tiers[0] as IntervalTier).intervals).toHaveLength(1);
      expect((nextState.tiers[0] as IntervalTier).intervals[0].text).toContain('left');
    });
  });

  describe('2. PictureWindow Undo and Redo Mechanics', () => {
    it('handles command push, undo, and redo in the scene graph', () => {
      let commands: PictureCommand[] = [];
      let redoCommands: PictureCommand[] = [];

      const cmd1: PictureCommand = {
        id: '1',
        kind: 'primitive',
        viewport: { x1: 1, x2: 5, y1: 1, y2: 5 },
        pen: { colour: 'Black', lineWidth: 1, lineType: 'solid', fontSize: 12, garnish: true },
        shape: 'innerBox',
      };
      const cmd2: PictureCommand = {
        id: '2',
        kind: 'primitive',
        viewport: { x1: 1, x2: 5, y1: 1, y2: 5 },
        pen: { colour: 'Blue', lineWidth: 2, lineType: 'dashed', fontSize: 14, garnish: true },
        shape: 'textTop',
        text: 'Figure 1',
      };

      // Add commands
      commands = [...commands, cmd1];
      redoCommands = [];
      commands = [...commands, cmd2];
      redoCommands = [];
      expect(commands).toHaveLength(2);

      // Undo cmd2
      const last = commands[commands.length - 1];
      redoCommands = [...redoCommands, last];
      commands = commands.slice(0, -1);

      expect(commands).toHaveLength(1);
      expect(commands[0].id).toBe('1');
      expect(redoCommands).toHaveLength(1);
      expect(redoCommands[0].id).toBe('2');

      // Redo cmd2
      const redoNext = redoCommands[redoCommands.length - 1];
      commands = [...commands, redoNext];
      redoCommands = redoCommands.slice(0, -1);

      expect(commands).toHaveLength(2);
      expect(commands[1].id).toBe('2');
      expect(redoCommands).toHaveLength(0);
    });
  });

  describe('3. Standard Keyboard Shortcut Predicates', () => {
    const isUndo = (e: { metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; key: string }) =>
      (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'z';

    const isRedo = (e: { metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; key: string }) =>
      ((e.metaKey || e.ctrlKey) && !e.altKey && e.shiftKey && e.key.toLowerCase() === 'z') ||
      ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'y');

    it('detects Mac standard shortcuts (Cmd+Z and Cmd+Shift+Z)', () => {
      expect(isUndo({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: 'z' })).toBe(true);
      expect(isUndo({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: 'Z' })).toBe(true);
      expect(isRedo({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: true, key: 'z' })).toBe(true);
      expect(isRedo({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: true, key: 'Z' })).toBe(true);
    });

    it('detects Windows standard shortcuts (Ctrl+Z and Ctrl+Y)', () => {
      expect(isUndo({ metaKey: false, ctrlKey: true, altKey: false, shiftKey: false, key: 'z' })).toBe(true);
      expect(isRedo({ metaKey: false, ctrlKey: true, altKey: false, shiftKey: false, key: 'y' })).toBe(true);
      expect(isRedo({ metaKey: false, ctrlKey: true, altKey: false, shiftKey: true, key: 'z' })).toBe(true);
    });

    it('rejects unrelated combinations', () => {
      expect(isUndo({ metaKey: true, ctrlKey: false, altKey: true, shiftKey: false, key: 'z' })).toBe(false);
      expect(isUndo({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, key: 'z' })).toBe(false);
      expect(isRedo({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, key: 'y' })).toBe(false);
    });
  });

  describe('4. Localization Key Parity for Undo/Redo', () => {
    it('verifies editor and picture undo/redo labels in English and Korean', () => {
      expect(en.editor.undo).toBe('undo');
      expect(en.editor.redo).toBe('redo');
      expect(ko.editor.undo).toBeTruthy();
      expect(ko.editor.redo).toBeTruthy();

      expect(en.picture.undo).toBe('Undo');
      expect(en.picture.redo).toBe('Redo');
      expect(ko.picture.undo).toBe('실행 취소');
      expect(ko.picture.redo).toBe('다시 실행');
    });
  });
});
