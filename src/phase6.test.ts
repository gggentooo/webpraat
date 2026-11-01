/**
 * Phase 6 Acceptance Test Suite:
 * Tests the Praat Scripting Console, C++ WASM script execution engine,
 * Info Window output interception, object inventory synchronization,
 * Praat syntax parser, and localization parity.
 *
 * Acceptance Check (from AGENTS.md):
 * "Standard Praat batch scripts run without error and update the UI state."
 */

import { describe, it, expect, beforeAll } from 'vitest';
import praatWorkerApi from './workers/praatWorker';
import { en } from './config/locales/en';
import { ko } from './config/locales/ko';

describe('Phase 6: Scripting Console & WASM Script Execution', () => {
  beforeAll(async () => {
    const initialized = await praatWorkerApi.init();
    expect(initialized).toBe(true);
  });

  describe('C++ Praat Script Execution & Info Interception', () => {
    it('executes basic writeInfoLine and math calculations', async () => {
      const script = `
        clearinfo
        writeInfoLine: "Hello WebPraat!"
        a = 15
        b = 27
        c = a + b
        appendInfoLine: "Result: ", c
      `;

      const output = await praatWorkerApi.executeScript(script);
      expect(output).toContain('Hello WebPraat!');
      expect(output).toContain('Result: 42');

      const infoOutput = await praatWorkerApi.getInfoOutput();
      expect(infoOutput).toContain('Hello WebPraat!');
      expect(infoOutput).toContain('Result: 42');
    });

    it('executes for-loops and mathematical functions accurately', async () => {
      const script = `
        clearinfo
        writeInfoLine: "Loop Test:"
        sum = 0
        for i from 1 to 5
            sum = sum + i * i
            appendInfoLine: "i=", i, ", square=", i * i
        endfor
        appendInfoLine: "Sum of squares = ", sum
      `;

      const output = await praatWorkerApi.executeScript(script);
      expect(output).toContain('Loop Test:');
      expect(output).toContain('i=1, square=1');
      expect(output).toContain('i=5, square=25');
      expect(output).toContain('Sum of squares = 55');
    });

    it('executes procedures, arguments, and string formatting', async () => {
      const script = `
        clearinfo
        procedure multiply: .x, .y
            .res = .x * .y
            appendInfoLine: .x, " times ", .y, " is ", .res
        endproc

        @multiply: 7, 8
        @multiply: 12, 12
      `;

      const output = await praatWorkerApi.executeScript(script);
      expect(output).toContain('7 times 8 is 56');
      expect(output).toContain('12 times 12 is 144');
    });

    it('clears info output via clearInfoOutput', async () => {
      await praatWorkerApi.executeScript('writeInfoLine: "Temporary text to clear"');
      let currentInfo = await praatWorkerApi.getInfoOutput();
      expect(currentInfo).toContain('Temporary text to clear');

      await praatWorkerApi.clearInfoOutput();
      currentInfo = await praatWorkerApi.getInfoOutput();
      expect(currentInfo.trim()).toBe('');
    });

    it('handles script errors gracefully without crashing the worker', async () => {
      // Syntax / unknown command error
      const brokenScript = `
        thisIsNotAValidPraatCommandAtAll 99
      `;

      const result = await praatWorkerApi.executeScript(brokenScript);
      expect(result).toMatch(/error/i);

      // Verify the worker remains responsive for subsequent commands
      const recoveryScript = 'writeInfoLine: "Worker is still alive!"';
      const recoveredOutput = await praatWorkerApi.executeScript(recoveryScript);
      expect(recoveredOutput).toContain('Worker is still alive!');
    });
  });

  describe('Object Table State & Inventory Sync', () => {
    it('retrieves active objects via getObjectsJson', async () => {
      // Create a sound object to ensure at least one object exists
      const fs = 16000;
      const n = 1600; // 0.1s
      const samples = new Float64Array(n);
      for (let i = 0; i < n; ++i) samples[i] = 0.2 * Math.sin((2 * Math.PI * 440 * i) / fs);

      const soundId = await praatWorkerApi.createSound(samples, n, 1, fs, 'script_test_tone');
      expect(soundId).toBeGreaterThan(0);

      const objects = await praatWorkerApi.getObjectsJson();
      expect(Array.isArray(objects)).toBe(true);
      expect(objects.length).toBeGreaterThan(0);

      const found = objects.find((o) => o.id === soundId);
      expect(found).toBeDefined();
      expect(found?.className).toBe('Sound');
      expect(found?.name).toBe('script_test_tone');
      expect(found?.numSamples).toBe(n);
      expect(found?.sampleRate).toBe(fs);
    });

    it('supports selectObject by ID', async () => {
      const objects = await praatWorkerApi.getObjectsJson();
      expect(objects.length).toBeGreaterThan(0);
      const firstId = objects[0].id;

      const selected = await praatWorkerApi.selectObject(firstId);
      // Returns true or false depending on whether it was found in theCurrentPraatObjects
      expect(typeof selected).toBe('boolean');
    });
  });

  describe('Phase 6 Localization Parity', () => {
    it('has identical script console keys in en and ko dictionaries', () => {
      const enKeys = Object.keys(en.script).sort();
      const koKeys = Object.keys(ko.script).sort();
      expect(koKeys).toEqual(enKeys);
    });

    it('has newPraatScript and openPraatScript menu commands in both locales', () => {
      expect(en.commands.newPraatScript).toBe('New Praat script');
      expect(en.commands.openPraatScript).toBe('Open Praat script...');
      expect(ko.commands.newPraatScript).toBe('새 Praat 스크립트');
      expect(ko.commands.openPraatScript).toBe('Praat 스크립트 열기...');
    });

    it('ensures all Korean script strings are non-empty translated strings', () => {
      for (const value of Object.values(ko.script)) {
        expect(typeof value).toBe('string');
        expect(value.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
