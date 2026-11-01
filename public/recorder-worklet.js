/**
 * WebPraat AudioWorkletProcessor for low-latency microphone capture and metering.
 * Loaded via AudioContext.audioWorklet.addModule('/recorder-worklet.js').
 */
class PraatRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._recording = false;
    this._meterTick = 0;

    this.port.onmessage = (event) => {
      const msg = event.data;
      if (msg && msg.type === 'setRecording') {
        this._recording = Boolean(msg.recording);
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    let sumSq = 0;
    let totalSamples = 0;
    let peak = 0;

    for (let ch = 0; ch < input.length; ch++) {
      const chan = input[ch];
      if (!chan) continue;
      for (let i = 0; i < chan.length; i++) {
        const s = chan[i];
        const abs = s < 0 ? -s : s;
        if (abs > peak) peak = abs;
        sumSq += s * s;
      }
      totalSamples += chan.length;
    }

    const rms = totalSamples > 0 ? Math.sqrt(sumSq / totalSamples) : 0;
    const clipped = peak >= 0.99;

    if (this._recording) {
      const channels = new Array(input.length);
      const transferList = [];
      for (let ch = 0; ch < input.length; ch++) {
        const copy = new Float32Array(input[ch]);
        channels[ch] = copy;
        transferList.push(copy.buffer);
      }
      this.port.postMessage(
        {
          type: 'audio',
          channels,
          rms,
          peak,
          clipped,
        },
        transferList
      );
    } else {
      this._meterTick++;
      if (this._meterTick >= 8) {
        this._meterTick = 0;
        this.port.postMessage({
          type: 'meter',
          rms,
          peak,
          clipped,
        });
      }
    }

    return true;
  }
}

registerProcessor('praat-recorder-processor', PraatRecorderProcessor);
