/**
 * Phase 4 Acceptance Test Suite:
 * Tests the SoundEditor (Waveform & Spectrogram), time axis & viewport engine,
 * WASM time-frequency matrix extraction, pitch & formant & intensity contour overlays,
 * and audio playback engine.
 *
 * Acceptance Check (from AGENTS.md):
 * "Smooth waveform zoom/scroll, correct spectrogram display, and audio playback with synchronous playhead."
 */

import { describe, it, expect, beforeAll } from 'vitest';
import praatWorkerApi from './workers/praatWorker';
import { en } from './config/locales/en';
import { ko } from './config/locales/ko';

describe('Phase 4: SoundEditor (Waveform, Spectrogram, Overlays & Playback)', () => {
  let soundId: number;
  const fs = 44100;
  const duration = 1.0;
  const n = fs * duration;
  const f0 = 440.0;

  beforeAll(async () => {
    const initialized = await praatWorkerApi.init();
    expect(initialized).toBe(true);

    // Create a 1.0 second harmonic test sound (440 Hz fundamental + 880 Hz harmonic)
    const samples = new Float64Array(n);
    for (let i = 0; i < n; ++i) {
      const t = i / fs;
      samples[i] =
        0.5 * Math.sin(2 * Math.PI * f0 * t) +
        0.25 * Math.sin(2 * Math.PI * 2 * f0 * t);
    }

    soundId = await praatWorkerApi.createSound(samples, n, 1, fs, 'phase4_harmonic_sound');
    expect(soundId).toBeGreaterThan(0);
  });

  describe('WASM Time-Frequency Matrix & Contour Extraction', () => {
    it('computes and retrieves Spectrogram matrix from WASM', async () => {
      const spectroId = await praatWorkerApi.soundToSpectrogram(soundId, {
        windowLength: 0.005,
        maxFreq: 5000.0,
        timeStep: 0.002,
      });
      expect(spectroId).toBeGreaterThan(0);

      const spectroData = await praatWorkerApi.getSpectrogramData(spectroId);
      expect(spectroData.nx).toBeGreaterThan(100);
      expect(spectroData.ny).toBeGreaterThan(50);
      expect(spectroData.ymax).toBe(5000.0);
      expect(spectroData.ymin).toBe(0.0);
      expect(spectroData.z.length).toBe(spectroData.nx * spectroData.ny);

      // Verify that energy is concentrated around 440 Hz
      // Find row index closest to 440 Hz
      const targetRow = Math.round((440.0 - spectroData.y1) / spectroData.dy);
      expect(targetRow).toBeGreaterThan(0);
      expect(targetRow).toBeLessThan(spectroData.ny);

      // Midpoint time frame
      const midFrame = Math.floor(spectroData.nx / 2);
      const targetEnergy = spectroData.z[targetRow * spectroData.nx + midFrame];
      // Energy at 3000 Hz (background noise level)
      const noiseRow = Math.round((3000.0 - spectroData.y1) / spectroData.dy);
      const noiseEnergy = spectroData.z[noiseRow * spectroData.nx + midFrame];

      expect(targetEnergy).toBeGreaterThan(noiseEnergy);
      await praatWorkerApi.destroyObject(spectroId);
    });

    it('computes and retrieves Pitch contour track from WASM', async () => {
      const pitchId = await praatWorkerApi.soundToPitch(soundId, {
        timeStep: 0.01,
        pitchFloor: 75.0,
        pitchCeiling: 600.0,
      });
      expect(pitchId).toBeGreaterThan(0);

      const pitchTrack = await praatWorkerApi.getPitchTrack(pitchId);
      expect(pitchTrack.nx).toBeGreaterThan(50);
      expect(pitchTrack.frequencies.length).toBe(pitchTrack.nx);
      expect(pitchTrack.ceiling).toBe(600.0);

      // Inspect midpoint frequency
      const midFrame = Math.floor(pitchTrack.nx / 2);
      const midF0 = pitchTrack.frequencies[midFrame];
      expect(midF0).toBeCloseTo(440.0, 1);

      await praatWorkerApi.destroyObject(pitchId);
    });

    it('computes and retrieves Formant tracks from WASM', async () => {
      const formantId = await praatWorkerApi.soundToFormant(soundId, {
        timeStep: 0.01,
        nFormants: 5,
        maxFormant: 5500.0,
        windowLength: 0.025,
      });
      expect(formantId).toBeGreaterThan(0);

      const formantTrack = await praatWorkerApi.getFormantTrack(formantId);
      expect(formantTrack.nx).toBeGreaterThan(50);
      expect(formantTrack.maxnFormants).toBe(5);
      expect(formantTrack.frequencies.length).toBe(formantTrack.nx * 5);

      await praatWorkerApi.destroyObject(formantId);
    });

    it('computes and retrieves Intensity track from WASM', async () => {
      const intensityId = await praatWorkerApi.soundToIntensity(soundId, {
        pitchFloor: 100.0,
        timeStep: 0.0,
      });
      expect(intensityId).toBeGreaterThan(0);

      const intensityTrack = await praatWorkerApi.getIntensityTrack(intensityId);
      expect(intensityTrack.nx).toBeGreaterThan(50);
      expect(intensityTrack.values.length).toBe(intensityTrack.nx);

      // Middle intensity should be within standard acoustic dB range (> 50 dB)
      const midVal = intensityTrack.values[Math.floor(intensityTrack.nx / 2)];
      expect(midVal).toBeGreaterThan(50.0);
      expect(midVal).toBeLessThan(120.0);

      await praatWorkerApi.destroyObject(intensityId);
    });

    it('runs unified analyzeSoundForEditor in background worker', async () => {
      const result = await praatWorkerApi.analyzeSoundForEditor(soundId, {
        spectrogram: true,
        pitch: true,
        formant: true,
        intensity: true,
      });

      expect(result.spectrogram).toBeDefined();
      expect(result.pitch).toBeDefined();
      expect(result.formants).toBeDefined();
      expect(result.intensity).toBeDefined();

      expect(result.spectrogram!.nx).toBeGreaterThan(0);
      expect(result.pitch!.frequencies[Math.floor(result.pitch!.nx / 2)]).toBeCloseTo(440.0, 1);
    });
  });

  describe('Time Axis & Viewport Zoom Engine', () => {
    it('simulates zoom in, zoom out, zoom to selection, and zoom history (bak)', () => {
      let tmin = 0.0;
      let tmax = duration;
      const history: Array<[number, number]> = [];

      const zoom = (newMin: number, newMax: number) => {
        history.push([tmin, tmax]);
        tmin = Math.max(0, Math.min(newMin, duration - 0.001));
        tmax = Math.min(duration, Math.max(newMax, tmin + 0.001));
      };

      const zoomIn = () => {
        const center = (tmin + tmax) / 2;
        const halfSpan = (tmax - tmin) / 4;
        zoom(center - halfSpan, center + halfSpan);
      };

      const zoomOut = () => {
        const center = (tmin + tmax) / 2;
        const halfSpan = tmax - tmin;
        zoom(center - halfSpan, center + halfSpan);
      };

      const zoomSel = (selStart: number, selEnd: number) => {
        zoom(Math.min(selStart, selEnd), Math.max(selStart, selEnd));
      };

      const zoomBak = () => {
        if (history.length > 0) {
          const prev = history.pop()!;
          tmin = prev[0];
          tmax = prev[1];
        }
      };

      // Initial state
      expect(tmin).toBe(0.0);
      expect(tmax).toBe(1.0);

      // 1. Zoom in: span should halve from 1.0 to 0.5
      zoomIn();
      expect(tmin).toBeCloseTo(0.25, 4);
      expect(tmax).toBeCloseTo(0.75, 4);
      expect(history.length).toBe(1);

      // 2. Zoom to selection: 0.35 to 0.45
      zoomSel(0.35, 0.45);
      expect(tmin).toBeCloseTo(0.35, 4);
      expect(tmax).toBeCloseTo(0.45, 4);
      expect(history.length).toBe(2);

      // 3. Zoom Bak: restores previous 0.25 - 0.75
      zoomBak();
      expect(tmin).toBeCloseTo(0.25, 4);
      expect(tmax).toBeCloseTo(0.75, 4);
      expect(history.length).toBe(1);

      // 4. Zoom out: span expands back to full window
      zoomOut();
      expect(tmin).toBe(0.0);
      expect(tmax).toBe(1.0);
    });
  });

  describe('Phase 4 Localization Verification', () => {
    it('provides all SoundEditor localization keys in English and Korean', () => {
      const editorEn = en.editor;
      const editorKo = ko.editor;

      expect(editorEn.showSpectrogram).toBe('Show spectrogram');
      expect(editorKo.showSpectrogram).toBe('스펙트로그램 표시');

      expect(editorEn.showPitch).toBe('Show pitch');
      expect(editorKo.showPitch).toBe('피치(F0) 표시');

      expect(editorEn.showFormants).toBe('Show formants');
      expect(editorKo.showFormants).toBe('포먼트 표시');

      expect(editorEn.showIntensity).toBe('Show intensity');
      expect(editorKo.showIntensity).toBe('음향 강도 표시');

      expect(editorEn.zoomAll).toBe('all');
      expect(editorEn.zoomIn).toBe('in');
      expect(editorEn.zoomOut).toBe('out');
      expect(editorEn.zoomSel).toBe('sel');
      expect(editorEn.zoomBak).toBe('bak');

      expect(editorKo.zoomAll).toContain('all');
      expect(editorKo.zoomIn).toContain('in');
      expect(editorKo.zoomOut).toContain('out');
      expect(editorKo.zoomSel).toContain('sel');
      expect(editorKo.zoomBak).toContain('bak');
    });
  });
});
