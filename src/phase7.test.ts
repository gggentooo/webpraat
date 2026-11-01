/**
 * Phase 7 Acceptance Test Suite:
 * Tests AudioWorklet Microphone Recording accumulation & resampling,
 * Advanced C++ WASM DSP modules (`dwtools` PowerCepstrogram/CPP/KlattGrid/MFCC,
 * `LPC`, `artsynth` Speaker + Artword articulatory synthesis),
 * Praat PictureWindow vector SVG rendering & script parsing,
 * OPFS Workspace Persistence round-trips, and EN/KO localization parity.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import praatWorkerApi from './workers/praatWorker';
import { RecorderBufferAccumulator, resampleChannelBuffer } from './utils/recorder';
import {
  parsePraatPictureScriptCommands,
  renderPictureToSvg,
} from './utils/pictureRenderer';
import {
  InMemoryDirectoryAdapter,
  clearWorkspaceFromOpfs,
  loadWorkspaceFromOpfs,
  saveWorkspaceToOpfs,
} from './utils/persistence';
import type { PicturePenSettings, PictureViewport, PraatObject } from './types/praat';
import { en } from './config/locales/en';
import { ko } from './config/locales/ko';

describe('Phase 7: Microphone Recording, PictureWindow, Advanced DSP & OPFS Persistence', () => {
  beforeAll(async () => {
    const ok = await praatWorkerApi.init();
    expect(ok).toBe(true);
  });

  describe('1. AudioWorklet Microphone Buffer Capture & Sound Registration', () => {
    it('accumulates 128-frame AudioWorklet chunks, computes metering, resamples, and creates a WASM Sound', async () => {
      const hardwareRate = 48000;
      const targetRate = 16000;
      const f0 = 220; // A3
      const totalBlocks = 188; // ~0.5013s at 48 kHz (188 * 128 = 24064 frames)
      const acc = new RecorderBufferAccumulator(1, hardwareRate);

      let sampleIndex = 0;
      let lastSnap = acc.appendChunk([]);
      expect(lastSnap.numSamples).toBe(0);

      for (let b = 0; b < totalBlocks; b++) {
        const quantum = new Float32Array(128);
        for (let i = 0; i < 128; i++) {
          quantum[i] = 0.6 * Math.sin((2 * Math.PI * f0 * sampleIndex) / hardwareRate);
          sampleIndex++;
        }
        lastSnap = acc.appendChunk([quantum]);
      }

      expect(acc.numSamples).toBe(totalBlocks * 128);
      expect(lastSnap.peak).toBeGreaterThan(0.58);
      expect(lastSnap.rms).toBeGreaterThan(0.35);
      expect(acc.clipped).toBe(false);

      const preview = acc.getWaveformPreview(64);
      expect(preview.length).toBe(64);

      const captured = acc.exportCapturedBuffer(targetRate);
      expect(captured.sampleRate).toBe(targetRate);
      expect(captured.channels).toBe(1);
      expect(captured.numSamples).toBeCloseTo(Math.round((totalBlocks * 128) / 3), -1);

      const soundId = await praatWorkerApi.createSound(
        captured.samples,
        captured.numSamples,
        captured.channels,
        captured.sampleRate,
        'mic_recorded_a3'
      );
      expect(soundId).toBeGreaterThan(0);

      const pitchId = await praatWorkerApi.soundToPitch(soundId, {
        pitchFloor: 75,
        pitchCeiling: 500,
      });
      const meanF0 = await praatWorkerApi.pitchGetMean(pitchId, 0, 0);
      expect(meanF0).toBeGreaterThan(215);
      expect(meanF0).toBeLessThan(225);

      await praatWorkerApi.destroyObject(pitchId);
      await praatWorkerApi.destroyObject(soundId);
    });

    it('captures stereo channels in channel-major order and detects clipping', () => {
      const acc = new RecorderBufferAccumulator(2, 44100);
      const left = new Float32Array(128).fill(0.25);
      const right = new Float32Array(128).fill(-1.0); // clipped!
      const snap = acc.appendChunk([left, right]);

      expect(snap.clipped).toBe(true);
      const out = acc.exportCapturedBuffer(44100);
      expect(out.channels).toBe(2);
      expect(out.numSamples).toBe(128);
      expect(out.samples[0]).toBeCloseTo(0.25, 5);
      expect(out.samples[128]).toBeCloseTo(-1.0, 5);

      const resampled = resampleChannelBuffer(new Float64Array(44100).fill(0.5), 44100, 22050);
      expect(resampled.length).toBe(22050);
    });
  });

  describe('2. Advanced C++ DSP Modules (dwtools, LPC, artsynth)', () => {
    it('synthesizes vowel speech via KlattGrid and extracts Formants, LPC, MFCC, PowerCepstrogram & CPP', async () => {
      // 1. Create KlattGrid from vowel /a/ (F0=125 Hz, F1=800 Hz, F2=1200 Hz)
      const kgId = await praatWorkerApi.createKlattGridFromVowel({
        name: 'vowel_a',
        duration: 0.5,
        f0Start: 125.0,
        f1: 800.0,
        b1: 50.0,
        f2: 1200.0,
        b2: 60.0,
        f3: 2300.0,
        b3: 100.0,
        f4: 2800.0,
      });
      expect(kgId).toBeGreaterThan(0);
      expect(await praatWorkerApi.getObjectClass(kgId)).toBe('KlattGrid');

      // 2. Synthesize Sound from KlattGrid
      const synthSoundId = await praatWorkerApi.klattGridToSound(kgId);
      expect(synthSoundId).toBeGreaterThan(0);
      const soundInfo = await praatWorkerApi.getSoundInfo(synthSoundId);
      expect(soundInfo.duration).toBeCloseTo(0.5, 2);
      expect(soundInfo.numSamples).toBeGreaterThan(1000);

      // 3. PowerCepstrogram -> Get CPPS & To CPP
      const cepstroId = await praatWorkerApi.soundToPowerCepstrogram(synthSoundId, {
        pitchFloor: 60.0,
        timeStep: 0.002,
        maxFreq: 5000.0,
        preEmphasis: 50.0,
      });
      expect(cepstroId).toBeGreaterThan(0);
      expect(await praatWorkerApi.getObjectClass(cepstroId)).toBe('PowerCepstrogram');

      const cpps = await praatWorkerApi.powerCepstrogramGetCpps(cepstroId, {
        subtractTrend: true,
        timeAveragingWindow: 0.02,
        quefrencyAveragingWindow: 0.0005,
        pitchFloor: 60.0,
        pitchCeiling: 330.0,
      });
      expect(Number.isFinite(cpps)).toBe(true);
      expect(cpps).toBeGreaterThan(2.0); // Periodic vowel has strong cepstral peak prominence

      const cppId = await praatWorkerApi.powerCepstrogramToCpp(cepstroId, 60.0, 330.0);
      expect(cppId).toBeGreaterThan(0);
      expect(await praatWorkerApi.getObjectClass(cppId)).toBe('CPP');

      const cppTrack = await praatWorkerApi.getCppTrack(cppId);
      expect(cppTrack.nx).toBeGreaterThan(10);
      const meanCpp = await praatWorkerApi.cppGetMean(cppId, 0, 0);
      expect(meanCpp).toBeGreaterThan(2.0);

      // 4. LPC (Burg) -> Formant
      const lpcId = await praatWorkerApi.soundToLpcBurg(synthSoundId, {
        predictionOrder: 16,
        windowLength: 0.025,
        timeStep: 0.005,
        preEmphasis: 50.0,
      });
      expect(lpcId).toBeGreaterThan(0);
      expect(await praatWorkerApi.getObjectClass(lpcId)).toBe('LPC');

      const formantId = await praatWorkerApi.lpcToFormant(lpcId);
      expect(formantId).toBeGreaterThan(0);
      expect(await praatWorkerApi.getObjectClass(formantId)).toBe('Formant');
      const fmtTrack = await praatWorkerApi.getFormantTrack(formantId);
      expect(fmtTrack.nx).toBeGreaterThan(10);

      // 5. MFCC
      const mfccId = await praatWorkerApi.soundToMfcc(synthSoundId, {
        numCoefficients: 12,
        windowLength: 0.015,
        timeStep: 0.005,
        f1Mel: 100.0,
        dfMel: 100.0,
      });
      expect(mfccId).toBeGreaterThan(0);
      expect(await praatWorkerApi.getObjectClass(mfccId)).toBe('MFCC');
      const mfccInfo = await praatWorkerApi.getMfccInfo(mfccId);
      expect(mfccInfo.maxNumCoefficients).toBe(12);
      expect(mfccInfo.nx).toBeGreaterThan(20);

      // 6. Sound -> KlattGrid (simple) resynthesis
      const resynthKgId = await praatWorkerApi.soundToKlattGrid(synthSoundId);
      expect(resynthKgId).toBeGreaterThan(0);
      expect(await praatWorkerApi.getObjectClass(resynthKgId)).toBe('KlattGrid');

      // Cleanup
      for (const id of [
        resynthKgId,
        mfccId,
        formantId,
        lpcId,
        cppId,
        cepstroId,
        synthSoundId,
        kgId,
      ]) {
        await praatWorkerApi.destroyObject(id);
      }
    });

    it('synthesizes speech from physical vocal-tract articulatory model (Speaker + Artword -> Sound)', async () => {
      const speakerId = await praatWorkerApi.createSpeaker('female_spk', 'female', 2);
      expect(speakerId).toBeGreaterThan(0);
      expect(await praatWorkerApi.getObjectClass(speakerId)).toBe('Speaker');

      const artwordId = await praatWorkerApi.createArtword('apa', 0.2, true);
      expect(artwordId).toBeGreaterThan(0);
      expect(await praatWorkerApi.getObjectClass(artwordId)).toBe('Artword');

      // Verify muscle target read/write (Muscle 1 = Lungs)
      await praatWorkerApi.artwordSetTarget(artwordId, 1, 0.1, 0.12);
      const targetVal = await praatWorkerApi.artwordGetTarget(artwordId, 1, 0.1);
      expect(targetVal).toBeCloseTo(0.12, 4);

      const artSoundId = await praatWorkerApi.artwordSpeakerToSound(
        artwordId,
        speakerId,
        22050,
        25
      );
      expect(artSoundId).toBeGreaterThan(0);
      const info = await praatWorkerApi.getSoundInfo(artSoundId);
      expect(info.duration).toBeCloseTo(0.2, 2);
      expect(info.sampleRate).toBe(22050);

      const samples = await praatWorkerApi.getSoundChannelSamples(artSoundId, 1);
      let maxAbs = 0;
      for (let i = 0; i < samples.length; i++) {
        const a = Math.abs(samples[i]);
        if (a > maxAbs) maxAbs = a;
      }
      expect(maxAbs).toBeGreaterThan(1e-4);

      await praatWorkerApi.destroyObject(artSoundId);
      await praatWorkerApi.destroyObject(artwordId);
      await praatWorkerApi.destroyObject(speakerId);
    }, 30000);
  });

  describe('3. PictureWindow Vector Rendering, SVG Export & Praat Picture Scripting', () => {
    const defaultVp: PictureViewport = { x1: 0, x2: 6, y1: 0, y2: 4 };
    const defaultPen: PicturePenSettings = {
      colour: 'Black',
      lineWidth: 1,
      lineType: 'solid',
      fontSize: 12,
      garnish: true,
    };

    it('exports multi-panel acoustic plots (Waveform, Spectrogram, Pitch, Formant speckles, TextGrid) to valid SVG', () => {
      const svg = renderPictureToSvg([
        {
          id: 'w1',
          kind: 'waveform',
          viewport: { x1: 0, x2: 6, y1: 0, y2: 3 },
          pen: defaultPen,
          title: 'utterance',
          tmin: 0,
          tmax: 0.5,
          minAmp: -0.8,
          maxAmp: 0.8,
          samples: new Float64Array([0, 0.5, -0.5, 0.3, -0.2, 0]),
          sampleRate: 16000,
        },
        {
          id: 'sp1',
          kind: 'spectrogram',
          viewport: { x1: 0, x2: 6, y1: 3, y2: 6 },
          pen: defaultPen,
          title: 'spectrogram',
          tmin: 0,
          tmax: 0.5,
          maxFreq: 5000,
          dynamicRange: 50,
          preemphasis: 6,
          colorMap: 'greyscale',
          nx: 4,
          ny: 4,
          y1: 0,
          dy: 1250,
          z: new Float64Array(16).fill(1e-5),
        },
        {
          id: 'p1',
          kind: 'pitch',
          viewport: { x1: 0, x2: 6, y1: 6, y2: 9 },
          pen: { ...defaultPen, colour: 'Blue' },
          title: 'pitch_contour',
          tmin: 0,
          tmax: 0.5,
          fmin: 75,
          fmax: 500,
          x1: 0.05,
          dx: 0.1,
          frequencies: new Float64Array([120, 145, 0, 180, 160]),
        },
        {
          id: 'f1',
          kind: 'formants',
          viewport: { x1: 6, x2: 12, y1: 0, y2: 4 },
          pen: { ...defaultPen, colour: 'Red' },
          title: 'formant_speckles',
          tmin: 0,
          tmax: 0.5,
          maxFreq: 5500,
          x1: 0.1,
          dx: 0.1,
          maxnFormants: 2,
          frequencies: new Float64Array([750, 1250, 760, 1280]),
          speckle: true,
        },
        {
          id: 'tg1',
          kind: 'textgrid',
          viewport: { x1: 6, x2: 12, y1: 4, y2: 7 },
          pen: defaultPen,
          title: 'annotation',
          tmin: 0,
          tmax: 1.0,
          data: {
            xmin: 0,
            xmax: 1.0,
            tiers: [
              {
                type: 'IntervalTier',
                name: 'phonemes',
                xmin: 0,
                xmax: 1.0,
                intervals: [
                  { xmin: 0, xmax: 0.5, text: 'pʰ' },
                  { xmin: 0.5, xmax: 1.0, text: 'aː' },
                ],
              },
            ],
          },
        },
      ]);

      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg).toContain('viewBox="0 0 864 864"');
      expect(svg).toContain('<path ');
      expect(svg).toContain('<image ');
      expect(svg).toContain('<circle ');
      expect(svg).toContain('Pitch (Hz)');
      expect(svg).toContain('Formant (Hz)');
      expect(svg).toContain('pʰ');
      expect(svg.endsWith('</svg>')).toBe(true);
    });

    it('parses Praat Picture drawing scripts into PictureCommands and separates DSP lines', () => {
      const script = `
        Erase all
        Select outer viewport: 0, 6, 0, 5
        Axes: 2500, 500, 900, 200
        Colour: "Blue"
        Line width: 2
        Draw inner box
        Paint circle: "Red", 1200, 750, 40
        Text top: "no", "Vowel Space"
        writeInfoLine: "Done plotting"
      `;

      const parsed = parsePraatPictureScriptCommands(script, defaultVp, defaultPen);
      expect(parsed.hasPictureCommands).toBe(true);
      expect(parsed.eraseAll).toBe(true);
      expect(parsed.commands.length).toBe(3); // innerBox, paintCircle, textTop
      expect(parsed.finalViewport).toEqual({ x1: 0, x2: 6, y1: 0, y2: 5 });
      expect(parsed.finalPen.colour).toBe('Blue');
      expect(parsed.finalPen.lineWidth).toBe(2);
      expect(parsed.remainingDspScript).toContain('writeInfoLine: "Done plotting"');
      expect(parsed.remainingDspScript).not.toContain('Erase all');
    });
  });

  describe('4. OPFS Workspace Persistence Round-Trip', () => {
    it('serializes Sound, Pitch, TextGrid & KlattGrid to binary OPFS storage and restores them after reload', async () => {
      const adapter = new InMemoryDirectoryAdapter();

      // Create objects in WASM
      const n = 3200; // 0.2s @ 16kHz
      const samples = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        samples[i] = 0.4 * Math.sin((2 * Math.PI * 200 * i) / 16000);
      }
      const soundId = await praatWorkerApi.createSound(samples, n, 1, 16000, 'persist_tone');
      const pitchId = await praatWorkerApi.soundToPitch(soundId);
      const tgId = await praatWorkerApi.createTextGrid(0, 0.2, 'words', '', 'persist_grid');
      await praatWorkerApi.textgridSetIntervalText(tgId, 1, 1, '안녕하세요');
      const kgId = await praatWorkerApi.createKlattGridFromVowel({ name: 'persist_kg' });

      const originalMeanF0 = await praatWorkerApi.pitchGetMean(pitchId, 0, 0);

      const workspaceObjects: PraatObject[] = [
        {
          id: soundId,
          className: 'Sound',
          name: 'persist_tone',
          duration: 0.2,
          sampleRate: 16000,
          numChannels: 1,
          numSamples: n,
        },
        { id: pitchId, className: 'Pitch', name: 'persist_tone_pitch' },
        { id: tgId, className: 'TextGrid', name: 'persist_grid' },
        { id: kgId, className: 'KlattGrid', name: 'persist_kg' },
      ];

      const manifest = await saveWorkspaceToOpfs(
        praatWorkerApi,
        workspaceObjects,
        'writeInfoLine: "persisted script"',
        adapter
      );
      expect(manifest.entries.length).toBe(4);

      // Destroy all 4 original C++ objects to simulate full browser tab reload
      await praatWorkerApi.destroyObject(soundId);
      await praatWorkerApi.destroyObject(pitchId);
      await praatWorkerApi.destroyObject(tgId);
      await praatWorkerApi.destroyObject(kgId);

      // Restore from OPFS adapter
      const restored = await loadWorkspaceFromOpfs(praatWorkerApi, adapter);
      expect(restored).not.toBeNull();
      expect(restored!.objects.length).toBe(4);
      expect(restored!.scriptText).toBe('writeInfoLine: "persisted script"');

      const [rSound, rPitch, rTg, rKg] = restored!.objects;
      expect(rSound.className).toBe('Sound');
      expect(rSound.name).toBe('persist_tone');
      expect(rSound.sampleRate).toBe(16000);
      expect(rSound.numSamples).toBe(n);

      expect(rPitch.className).toBe('Pitch');
      const restoredMeanF0 = await praatWorkerApi.pitchGetMean(rPitch.id, 0, 0);
      expect(restoredMeanF0).toBeCloseTo(originalMeanF0, 4);

      expect(rTg.className).toBe('TextGrid');
      const tgData = await praatWorkerApi.getTextGridData(rTg.id);
      expect(tgData.tiers[0].type).toBe('IntervalTier');
      if (tgData.tiers[0].type === 'IntervalTier') {
        expect(tgData.tiers[0].intervals[0].text).toBe('안녕하세요');
      }

      expect(rKg.className).toBe('KlattGrid');

      // Test object rename in C++ bridge as well
      const renamed = await praatWorkerApi.renameObject(rSound.id, 'renamed_tone');
      expect(renamed).toBe(true);
      expect(await praatWorkerApi.getObjectName(rSound.id)).toBe('renamed_tone');

      // Clear workspace
      await clearWorkspaceFromOpfs(adapter);
      expect(await loadWorkspaceFromOpfs(praatWorkerApi, adapter)).toBeNull();

      // Cleanup restored C++ objects
      for (const obj of restored!.objects) {
        await praatWorkerApi.destroyObject(obj.id);
      }
    });
  });

  describe('5. Full Localization Key Parity (English vs Korean)', () => {
    const collectKeys = (obj: Record<string, any>, prefix = ''): string[] => {
      const keys: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object') {
          keys.push(...collectKeys(v, path));
        } else {
          keys.push(path);
          expect(typeof v).toBe('string');
          expect((v as string).trim().length).toBeGreaterThan(0);
        }
      }
      return keys.sort();
    };

    it('maintains 100% recursive key parity and non-empty strings across en and ko', () => {
      const enKeys = collectKeys(en);
      const koKeys = collectKeys(ko);
      expect(koKeys).toEqual(enKeys);
    });
  });
});
