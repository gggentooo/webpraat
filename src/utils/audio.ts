/**
 * Audio Decoding, Encoding, and Worker integration utilities for WebPraat.
 */

import * as Comlink from 'comlink';
import type { PraatWorkerApi, SoundInfo } from '../types/wasm';

let workerInstance: Comlink.Remote<PraatWorkerApi> | null = null;

/**
 * Returns a singleton Comlink remote instance connecting to `praatWorker.ts`.
 */
export function getPraatWorker(): Comlink.Remote<PraatWorkerApi> {
  if (!workerInstance) {
    const worker = new Worker(
      new URL('../workers/praatWorker.ts', import.meta.url),
      { type: 'module' }
    );
    workerInstance = Comlink.wrap<PraatWorkerApi>(worker);
  }
  return workerInstance;
}

/**
 * Encodes audio samples to a standard 16-bit linear PCM RIFF WAV Blob.
 * 
 * @param samples Channel samples. If flat Float64Array with multiple channels,
 *                assumed contiguous: channel 1 [0..n-1], channel 2 [n..2n-1], etc.
 * @param sampleRate Sampling rate in Hz.
 * @param channels Number of audio channels (default 1).
 */
export function encodeWav(
  samples: Float64Array | Float32Array,
  sampleRate: number,
  channels: number = 1
): Blob {
  const nSamplesPerChannel = Math.floor(samples.length / channels);
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = nSamplesPerChannel * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; ++i) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // 1. RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // ChunkSize = 36 + SubChunk2Size
  writeString(8, 'WAVE');

  // 2. "fmt " Sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);             // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);              // AudioFormat (1 = PCM)
  view.setUint16(22, channels, true);       // NumChannels
  view.setUint32(24, sampleRate, true);     // SampleRate
  view.setUint32(28, byteRate, true);       // ByteRate
  view.setUint16(32, blockAlign, true);     // BlockAlign
  view.setUint16(34, 16, true);             // BitsPerSample (16 bits)

  // 3. "data" Sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write interleaved 16-bit samples
  let offset = 44;
  for (let i = 0; i < nSamplesPerChannel; ++i) {
    for (let ch = 0; ch < channels; ++ch) {
      const sample = samples[ch * nSamplesPerChannel + i];
      // Clamp to [-1.0, 1.0] and scale to 16-bit signed integer [-32768, 32767]
      const clamped = Math.max(-1.0, Math.min(1.0, sample));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, Math.floor(int16), true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Triggers a browser download of a given Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Decodes an audio file or buffer using the Web Audio API AudioContext.
 * Returns the raw samples as contiguous Float64Array.
 */
export async function decodeWithAudioContext(
  arrayBuffer: ArrayBuffer
): Promise<{ samples: Float64Array; sampleRate: number; channels: number }> {
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API AudioContext is not available in this environment');
  }

  const audioCtx = new AudioContextClass();
  try {
    // Clone buffer because decodeAudioData detaches the input buffer
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const channels = audioBuffer.numberOfChannels;
    const n = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    const samples = new Float64Array(channels * n);
    for (let ch = 0; ch < channels; ++ch) {
      const channelData = audioBuffer.getChannelData(ch);
      const offset = ch * n;
      for (let i = 0; i < n; ++i) {
        samples[offset + i] = channelData[i];
      }
    }

    return { samples, sampleRate, channels };
  } finally {
    if (audioCtx.state !== 'closed') {
      await audioCtx.close();
    }
  }
}

/**
 * Ingests an audio file (drag-and-drop or file input) into the Praat Web Worker.
 * Attempts native browser decoding first, falling back to Praat's internal WASM decoders.
 */
export async function loadAudioFile(
  worker: PraatWorkerApi,
  file: File | Blob,
  fallbackName?: string
): Promise<SoundInfo> {
  const name =
    (file as File).name?.replace(/\.[^/.]+$/, '') ||
    fallbackName ||
    'audio';

  const arrayBuffer = await file.arrayBuffer();

  // 1. Try decoding via AudioContext in browser if available
  if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
    try {
      const decoded = await decodeWithAudioContext(arrayBuffer);
      const soundId = await worker.createSound(
        decoded.samples,
        decoded.samples.length / decoded.channels,
        decoded.channels,
        decoded.sampleRate,
        name
      );
      return worker.getSoundInfo(soundId);
    } catch (err) {
      console.warn('Native AudioContext decode failed, falling back to WASM decoder:', err);
    }
  }

  // 2. Fallback to Praat C++ internal decoders (WAV, AIFF, MP3, FLAC, Vorbis)
  const uint8 = new Uint8Array(arrayBuffer);
  const soundId = await worker.readSoundFromBuffer(uint8, name);
  return worker.getSoundInfo(soundId);
}

/**
 * Exports a Sound object from the worker as a downloadable 16-bit PCM WAV Blob.
 */
export async function exportSoundToWavBlob(
  worker: PraatWorkerApi,
  soundId: number
): Promise<Blob> {
  const wavBytes = await worker.exportSoundAsWav(soundId);
  const copy = new Uint8Array(wavBytes.byteLength);
  copy.set(wavBytes);
  return new Blob([copy.buffer], { type: 'audio/wav' });
}
