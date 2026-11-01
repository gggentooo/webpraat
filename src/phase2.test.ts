/**
 * Phase 2 Acceptance Test Suite:
 * Tests the Web Worker API, Audio I/O, WAV encoding/decoding,
 * and drag-and-drop file ingestion workflow.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import praatWorkerApi from './workers/praatWorker';
import { encodeWav, loadAudioFile, exportSoundToWavBlob } from './utils/audio';

describe('Phase 2: Web Worker & Audio I/O Acceptance Tests', () => {
  beforeAll(async () => {
    const initialized = await praatWorkerApi.init();
    expect(initialized).toBe(true);
  });

  it('encodes synthetic audio to 16-bit PCM WAV and loads via file ingestion', async () => {
    // 1. Synthesize a 1.2 second 440 Hz mono sine wave at 44100 Hz
    const fs = 44100;
    const duration = 1.2;
    const n = Math.floor(fs * duration);
    const targetF0 = 440.0;
    const samples = new Float64Array(n);

    for (let i = 0; i < n; ++i) {
      samples[i] = 0.75 * Math.sin(2 * Math.PI * targetF0 * (i / fs));
    }

    // 2. Encode to 16-bit PCM WAV Blob
    const wavBlob = encodeWav(samples, fs, 1);
    expect(wavBlob.type).toBe('audio/wav');
    expect(wavBlob.size).toBe(44 + n * 2); // 44-byte header + 16-bit (2 bytes) per sample

    // 3. Simulate drag-and-drop File object
    const wavFile = new File([wavBlob], 'recorded_speech.wav', { type: 'audio/wav' });

    // 4. Ingest file into worker (tests acceptance criteria: returns duration, sampleRate, channel count)
    const soundInfo = await loadAudioFile(praatWorkerApi, wavFile);

    expect(soundInfo.id).toBeGreaterThan(0);
    expect(soundInfo.name).toBe('recorded_speech');
    expect(soundInfo.className).toBe('Sound');
    expect(soundInfo.sampleRate).toBe(44100);
    expect(soundInfo.numChannels).toBe(1);
    expect(soundInfo.numSamples).toBe(n);
    expect(soundInfo.duration).toBeCloseTo(duration, 3);

    // 5. Query channel samples from worker
    const extractedSamples = await praatWorkerApi.getSoundChannelSamples(soundInfo.id, 1);
    expect(extractedSamples.length).toBe(n);
    // Compare first 100 samples
    for (let i = 0; i < 100; ++i) {
      expect(extractedSamples[i]).toBeCloseTo(samples[i], 3);
    }

    // 6. Perform pitch analysis via Worker API
    const pitchId = await praatWorkerApi.soundToPitch(soundInfo.id, {
      pitchFloor: 75.0,
      pitchCeiling: 600.0,
    });
    expect(pitchId).toBeGreaterThan(0);

    const meanF0 = await praatWorkerApi.pitchGetMean(pitchId, 0.0, duration);
    expect(meanF0).toBeCloseTo(440.0, 1);

    // 7. Export Sound from worker to downloadable WAV Blob
    const exportedBlob = await exportSoundToWavBlob(praatWorkerApi, soundInfo.id);
    expect(exportedBlob.type).toBe('audio/wav');
    expect(exportedBlob.size).toBeGreaterThan(44);

    // 8. Ingest exported WAV back into worker to verify roundtrip integrity
    const roundtripFile = new File([exportedBlob], 'roundtrip.wav', { type: 'audio/wav' });
    const roundtripInfo = await loadAudioFile(praatWorkerApi, roundtripFile);

    expect(roundtripInfo.sampleRate).toBe(44100);
    expect(roundtripInfo.numChannels).toBe(1);
    expect(roundtripInfo.numSamples).toBe(n);
    expect(roundtripInfo.duration).toBeCloseTo(duration, 3);

    // Cleanup objects
    await praatWorkerApi.destroyObject(soundInfo.id);
    await praatWorkerApi.destroyObject(pitchId);
    await praatWorkerApi.destroyObject(roundtripInfo.id);
  });

  it('handles multi-channel stereo audio decoding and export', async () => {
    const fs = 22050;
    const duration = 0.8;
    const n = Math.floor(fs * duration);
    const channels = 2;
    const totalSamples = n * channels;
    const stereoData = new Float64Array(totalSamples);

    // Channel 1: 300 Hz, Channel 2: 600 Hz
    for (let i = 0; i < n; ++i) {
      stereoData[i] = 0.6 * Math.sin(2 * Math.PI * 300 * (i / fs)); // left channel
      stereoData[n + i] = 0.6 * Math.sin(2 * Math.PI * 600 * (i / fs)); // right channel
    }

    const stereoBlob = encodeWav(stereoData, fs, channels);
    expect(stereoBlob.size).toBe(44 + totalSamples * 2);

    const stereoFile = new File([stereoBlob], 'stereo_tone.wav', { type: 'audio/wav' });
    const soundInfo = await loadAudioFile(praatWorkerApi, stereoFile);

    expect(soundInfo.name).toBe('stereo_tone');
    expect(soundInfo.numChannels).toBe(2);
    expect(soundInfo.sampleRate).toBe(22050);
    expect(soundInfo.numSamples).toBe(n);
    expect(soundInfo.duration).toBeCloseTo(duration, 3);

    // Extract both channels and verify separation
    const leftChannel = await praatWorkerApi.getSoundChannelSamples(soundInfo.id, 1);
    const rightChannel = await praatWorkerApi.getSoundChannelSamples(soundInfo.id, 2);

    expect(leftChannel.length).toBe(n);
    expect(rightChannel.length).toBe(n);
    expect(leftChannel[10]).toBeCloseTo(stereoData[10], 3);
    expect(rightChannel[10]).toBeCloseTo(stereoData[n + 10], 3);

    await praatWorkerApi.destroyObject(soundInfo.id);
  });
});
