/**
 * AudioWorklet Microphone Recording Engine & In-Memory PCM Buffer Accumulator (Phase 7).
 */

export interface RecorderMeterSnapshot {
  rms: number;
  peak: number;
  clipped: boolean;
  duration: number;
  numSamples: number;
}

export interface CapturedSoundBuffer {
  samples: Float64Array; // Contiguous channel-major layout [ch0..., ch1...]
  numSamples: number;
  channels: number;
  sampleRate: number;
  duration: number;
}

/**
 * Resamples a single-channel Float64Array from `fromRate` to `toRate` using linear interpolation.
 */
export function resampleChannelBuffer(
  input: Float64Array,
  fromRate: number,
  toRate: number
): Float64Array {
  if (input.length === 0 || fromRate <= 0 || toRate <= 0 || Math.abs(fromRate - toRate) < 1e-3) {
    return input;
  }

  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float64Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const idx0 = Math.floor(srcPos);
    const idx1 = Math.min(input.length - 1, idx0 + 1);
    const frac = srcPos - idx0;
    output[i] = input[idx0] * (1.0 - frac) + input[idx1] * frac;
  }

  return output;
}

/**
 * Deterministic in-memory accumulator for multi-channel Float32 PCM chunks streamed from AudioWorklet.
 */
export class RecorderBufferAccumulator {
  private readonly targetChannels: 1 | 2;
  private captureSampleRate: number;
  private chunksPerChannel: Float32Array[][];
  private totalFrames = 0;
  private maxPeak = 0;
  private hasClipped = false;

  constructor(channels: 1 | 2 = 1, sampleRate = 44100) {
    this.targetChannels = channels;
    this.captureSampleRate = sampleRate;
    this.chunksPerChannel = Array.from({ length: channels }, () => []);
  }

  setCaptureSampleRate(sampleRate: number): void {
    if (sampleRate > 0) {
      this.captureSampleRate = sampleRate;
    }
  }

  get sampleRate(): number {
    return this.captureSampleRate;
  }

  get channels(): 1 | 2 {
    return this.targetChannels;
  }

  get numSamples(): number {
    return this.totalFrames;
  }

  get duration(): number {
    return this.captureSampleRate > 0 ? this.totalFrames / this.captureSampleRate : 0;
  }

  get peak(): number {
    return this.maxPeak;
  }

  get clipped(): boolean {
    return this.hasClipped;
  }

  clear(): void {
    this.chunksPerChannel = Array.from({ length: this.targetChannels }, () => []);
    this.totalFrames = 0;
    this.maxPeak = 0;
    this.hasClipped = false;
  }

  /**
   * Appends a single AudioWorklet quantum (typically 128 frames per channel).
   * If stereo is requested on a mono mic, duplicates channel 0 into channel 1.
   * If mono is requested on a stereo mic, averages channels 0 and 1.
   */
  appendChunk(inputChannels: Float32Array[]): RecorderMeterSnapshot {
    if (!inputChannels || inputChannels.length === 0 || inputChannels[0].length === 0) {
      return {
        rms: 0,
        peak: 0,
        clipped: this.hasClipped,
        duration: this.duration,
        numSamples: this.totalFrames,
      };
    }

    const frameCount = inputChannels[0].length;
    let sumSq = 0;
    let chunkPeak = 0;

    if (this.targetChannels === 1) {
      const mono = new Float32Array(frameCount);
      if (inputChannels.length >= 2 && inputChannels[1]?.length === frameCount) {
        const left = inputChannels[0];
        const right = inputChannels[1];
        for (let i = 0; i < frameCount; i++) {
          const s = 0.5 * (left[i] + right[i]);
          mono[i] = s;
          const abs = Math.abs(s);
          if (abs > chunkPeak) chunkPeak = abs;
          sumSq += s * s;
        }
      } else {
        const src = inputChannels[0];
        for (let i = 0; i < frameCount; i++) {
          const s = src[i];
          mono[i] = s;
          const abs = Math.abs(s);
          if (abs > chunkPeak) chunkPeak = abs;
          sumSq += s * s;
        }
      }
      this.chunksPerChannel[0].push(mono);
    } else {
      const leftSrc = inputChannels[0];
      const rightSrc =
        inputChannels.length >= 2 && inputChannels[1]?.length === frameCount
          ? inputChannels[1]
          : inputChannels[0];

      const leftCopy = new Float32Array(leftSrc);
      const rightCopy = new Float32Array(rightSrc);
      for (let i = 0; i < frameCount; i++) {
        const l = leftCopy[i];
        const r = rightCopy[i];
        const absL = Math.abs(l);
        const absR = Math.abs(r);
        if (absL > chunkPeak) chunkPeak = absL;
        if (absR > chunkPeak) chunkPeak = absR;
        sumSq += 0.5 * (l * l + r * r);
      }
      this.chunksPerChannel[0].push(leftCopy);
      this.chunksPerChannel[1].push(rightCopy);
    }

    this.totalFrames += frameCount;
    if (chunkPeak > this.maxPeak) this.maxPeak = chunkPeak;
    if (chunkPeak >= 0.99) this.hasClipped = true;

    const rms = Math.sqrt(sumSq / frameCount);
    return {
      rms,
      peak: chunkPeak,
      clipped: this.hasClipped,
      duration: this.duration,
      numSamples: this.totalFrames,
    };
  }

  /**
   * Exports a downsampled preview envelope (for SoundRecorder live waveform visualization).
   */
  getWaveformPreview(bins = 240): Float32Array {
    const out = new Float32Array(bins);
    if (this.totalFrames === 0 || bins <= 0) return out;

    const chan0Chunks = this.chunksPerChannel[0];
    const samplesPerBin = Math.max(1, Math.floor(this.totalFrames / bins));
    let globalIdx = 0;
    let binMax = 0;
    let currentBin = 0;

    for (let c = 0; c < chan0Chunks.length; c++) {
      const chunk = chan0Chunks[c];
      for (let i = 0; i < chunk.length; i++) {
        const v = chunk[i];
        if (Math.abs(v) > Math.abs(binMax)) {
          binMax = v;
        }
        globalIdx++;
        if (globalIdx % samplesPerBin === 0 && currentBin < bins) {
          out[currentBin++] = binMax;
          binMax = 0;
        }
      }
    }
    if (currentBin < bins) {
      out[currentBin] = binMax;
    }
    return out;
  }

  /**
   * Flattens captured PCM chunks into channel-major Float64Array ready for `praatWorker.createSound`,
   * resampling to `targetSampleRate` if requested.
   */
  exportCapturedBuffer(targetSampleRate?: number): CapturedSoundBuffer {
    const outRate = targetSampleRate && targetSampleRate > 0 ? targetSampleRate : this.captureSampleRate;
    if (this.totalFrames === 0) {
      return {
        samples: new Float64Array(0),
        numSamples: 0,
        channels: this.targetChannels,
        sampleRate: outRate,
        duration: 0,
      };
    }

    const perChannelResampled: Float64Array[] = [];
    for (let ch = 0; ch < this.targetChannels; ch++) {
      const raw = new Float64Array(this.totalFrames);
      let offset = 0;
      for (const chunk of this.chunksPerChannel[ch]) {
        raw.set(chunk, offset);
        offset += chunk.length;
      }
      perChannelResampled.push(resampleChannelBuffer(raw, this.captureSampleRate, outRate));
    }

    const finalSamplesPerChan = perChannelResampled[0].length;
    const contiguous = new Float64Array(finalSamplesPerChan * this.targetChannels);
    for (let ch = 0; ch < this.targetChannels; ch++) {
      contiguous.set(perChannelResampled[ch], ch * finalSamplesPerChan);
    }

    return {
      samples: contiguous,
      numSamples: finalSamplesPerChan,
      channels: this.targetChannels,
      sampleRate: outRate,
      duration: finalSamplesPerChan / outRate,
    };
  }
}

export interface AudioInputDeviceInfo {
  deviceId: string;
  label: string;
}

/**
 * Lists available audio input devices in the browser.
 */
export async function listAudioInputDevices(): Promise<AudioInputDeviceInfo[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'audioinput')
      .map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${idx + 1}`,
      }));
  } catch {
    return [];
  }
}

/**
 * Live browser microphone recording session backed by `AudioWorkletNode`.
 */
export class AudioRecorderSession {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  private previewSource: AudioBufferSourceNode | null = null;
  private accumulator: RecorderBufferAccumulator;
  private recording = false;

  constructor(channels: 1 | 2, targetSampleRate: number) {
    this.accumulator = new RecorderBufferAccumulator(channels, targetSampleRate);
  }

  get isRecording(): boolean {
    return this.recording;
  }

  get bufferAccumulator(): RecorderBufferAccumulator {
    return this.accumulator;
  }

  async openStream(
    channels: 1 | 2,
    preferredSampleRate: number,
    deviceId?: string,
    onMeter?: (meter: RecorderMeterSnapshot) => void
  ): Promise<void> {
    await this.dispose();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('MediaDevices API not supported in this browser');
    }

    const audioConstraints: MediaTrackConstraints = {
      channelCount: { ideal: channels },
      sampleRate: { ideal: preferredSampleRate },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
    if (deviceId && deviceId !== 'default') {
      audioConstraints.deviceId = { exact: deviceId };
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioCtx({ sampleRate: preferredSampleRate });
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.accumulator = new RecorderBufferAccumulator(channels, this.audioCtx.sampleRate);

    await this.audioCtx.audioWorklet.addModule('${import.meta.env.BASE_URL}recorder-worklet.js');

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.audioCtx, 'praat-recorder-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: channels,
    });

    // Connect through a zero-gain sink so Chromium/Safari keep pumping the AudioWorklet graph without feedback
    this.silentGain = this.audioCtx.createGain();
    this.silentGain.gain.value = 0;

    this.workletNode.port.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'audio' && this.recording) {
        const snap = this.accumulator.appendChunk(msg.channels as Float32Array[]);
        onMeter?.(snap);
      } else if (msg.type === 'meter') {
        onMeter?.({
          rms: msg.rms ?? 0,
          peak: msg.peak ?? 0,
          clipped: Boolean(msg.clipped),
          duration: this.accumulator.duration,
          numSamples: this.accumulator.numSamples,
        });
      }
    };

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.silentGain);
    this.silentGain.connect(this.audioCtx.destination);
  }

  startRecording(clearExisting = true): void {
    if (clearExisting) {
      this.accumulator.clear();
    }
    this.recording = true;
    this.workletNode?.port.postMessage({ type: 'setRecording', recording: true });
  }

  stopRecording(): void {
    this.recording = false;
    this.workletNode?.port.postMessage({ type: 'setRecording', recording: false });
  }

  async playPreview(targetSampleRate: number, onEnded?: () => void): Promise<void> {
    this.stopPreview();
    const captured = this.accumulator.exportCapturedBuffer(targetSampleRate);
    if (captured.numSamples === 0) return;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = this.audioCtx ?? new AudioCtx();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const audioBuffer = ctx.createBuffer(captured.channels, captured.numSamples, captured.sampleRate);
    for (let ch = 0; ch < captured.channels; ch++) {
      const chanData = audioBuffer.getChannelData(ch);
      const offset = ch * captured.numSamples;
      for (let i = 0; i < captured.numSamples; i++) {
        chanData[i] = captured.samples[offset + i];
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);
    src.onended = () => {
      if (this.previewSource === src) {
        this.previewSource = null;
      }
      onEnded?.();
    };
    this.previewSource = src;
    src.start(0);
  }

  stopPreview(): void {
    if (this.previewSource) {
      try {
        this.previewSource.stop();
        this.previewSource.disconnect();
      } catch {}
      this.previewSource = null;
    }
  }

  exportCaptured(targetSampleRate?: number): CapturedSoundBuffer {
    return this.accumulator.exportCapturedBuffer(targetSampleRate);
  }

  async dispose(): Promise<void> {
    this.stopRecording();
    this.stopPreview();

    if (this.workletNode) {
      try {
        this.workletNode.port.onmessage = null;
        this.workletNode.disconnect();
      } catch {}
      this.workletNode = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    if (this.silentGain) {
      try {
        this.silentGain.disconnect();
      } catch {}
      this.silentGain = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.audioCtx) {
      try {
        await this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }
}
