import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  modalAtom,
  objectsAtom,
  selectedIdsAtom,
  isProcessingAtom,
  statusMessageAtom,
  tAtom,
} from '../../store';
import { getPraatWorker } from '../../utils/audio';
import {
  AudioRecorderSession,
  listAudioInputDevices,
  type AudioInputDeviceInfo,
  type RecorderMeterSnapshot,
} from '../../utils/recorder';

const SAMPLE_RATES = [8000, 11025, 16000, 22050, 44100, 48000];

export const SoundRecorderModal: React.FC = () => {
  const [modal, setModal] = useAtom(modalAtom);
  const setObjects = useSetAtom(objectsAtom);
  const setSelectedIds = useSetAtom(selectedIdsAtom);
  const setIsProcessing = useSetAtom(isProcessingAtom);
  const setStatusMessage = useSetAtom(statusMessageAtom);
  const t = useAtomValue(tAtom);

  const isOpen = modal?.type === 'soundRecorder';
  const initialChannels = (modal?.initialValues?.channels === 2 ? 2 : 1) as 1 | 2;

  const [channels, setChannels] = useState<1 | 2>(initialChannels);
  const [sampleRate, setSampleRate] = useState<number>(44100);
  const [devices, setDevices] = useState<AudioInputDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  const [soundName, setSoundName] = useState<string>('untitled');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [meter, setMeter] = useState<RecorderMeterSnapshot>({
    rms: 0,
    peak: 0,
    clipped: false,
    duration: 0,
    numSamples: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sessionRef = useRef<AudioRecorderSession | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const drawWaveformPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const session = sessionRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Zero line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (!session || session.bufferAccumulator.numSamples === 0) return;

    const preview = session.bufferAccumulator.getWaveformPreview(width);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let x = 0; x < preview.length; x++) {
      const amp = Math.max(-1, Math.min(1, preview[x]));
      const yTop = height / 2 - Math.abs(amp) * (height * 0.45);
      const yBot = height / 2 + Math.abs(amp) * (height * 0.45);
      ctx.moveTo(x + 0.5, yTop);
      ctx.lineTo(x + 0.5, yBot);
    }
    ctx.stroke();
  }, []);

  const initMicrophoneStream = useCallback(
    async (ch: 1 | 2, sr: number, devId: string) => {
      setErrorMsg(null);
      const session = new AudioRecorderSession(ch, sr);
      sessionRef.current = session;
      try {
        await session.openStream(ch, sr, devId, (snap) => {
          setMeter(snap);
          if (session.isRecording) {
            drawWaveformPreview();
          }
        });
        const inputList = await listAudioInputDevices();
        setDevices(inputList);
      } catch (err) {
        console.warn('Microphone open failed:', err);
        setErrorMsg(t.recorder.permissionDenied);
      }
    },
    [drawWaveformPreview, t.recorder.permissionDenied]
  );

  useEffect(() => {
    if (!isOpen) return;
    const ch = (modal?.initialValues?.channels === 2 ? 2 : 1) as 1 | 2;
    setChannels(ch);
    setSoundName('untitled');
    setIsRecording(false);
    setIsPlayingPreview(false);
    setMeter({ rms: 0, peak: 0, clipped: false, duration: 0, numSamples: 0 });
    void initMicrophoneStream(ch, sampleRate, selectedDeviceId);

    return () => {
      if (sessionRef.current) {
        void sessionRef.current.dispose();
        sessionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = async () => {
    if (sessionRef.current) {
      await sessionRef.current.dispose();
      sessionRef.current = null;
    }
    setIsRecording(false);
    setIsPlayingPreview(false);
    setModal(null);
  };

  const handleSwitchConfig = async (nextChannels: 1 | 2, nextRate: number, nextDevice: string) => {
    if (isRecording) return;
    setChannels(nextChannels);
    setSampleRate(nextRate);
    setSelectedDeviceId(nextDevice);
    if (sessionRef.current) {
      await sessionRef.current.dispose();
      sessionRef.current = null;
    }
    setMeter({ rms: 0, peak: 0, clipped: false, duration: 0, numSamples: 0 });
    await initMicrophoneStream(nextChannels, nextRate, nextDevice);
    drawWaveformPreview();
  };

  const handleRecord = async () => {
    setErrorMsg(null);
    if (!sessionRef.current) {
      await initMicrophoneStream(channels, sampleRate, selectedDeviceId);
    }
    if (!sessionRef.current) return;
    sessionRef.current.stopPreview();
    setIsPlayingPreview(false);
    sessionRef.current.startRecording(true);
    setIsRecording(true);
    setMeter({ rms: 0, peak: 0, clipped: false, duration: 0, numSamples: 0 });
    drawWaveformPreview();
  };

  const handleStop = () => {
    if (!sessionRef.current) return;
    if (isRecording) {
      sessionRef.current.stopRecording();
      setIsRecording(false);
      drawWaveformPreview();
    }
    if (isPlayingPreview) {
      sessionRef.current.stopPreview();
      setIsPlayingPreview(false);
    }
  };

  const handlePlayPreview = async () => {
    if (!sessionRef.current || isRecording || meter.numSamples === 0) return;
    setIsPlayingPreview(true);
    await sessionRef.current.playPreview(sampleRate, () => {
      setIsPlayingPreview(false);
    });
  };

  const handleSave = async (closeAfterSave: boolean) => {
    const session = sessionRef.current;
    if (!session) return;
    if (isRecording) {
      session.stopRecording();
      setIsRecording(false);
    }
    const captured = session.exportCaptured(sampleRate);
    if (captured.numSamples === 0) {
      setErrorMsg(t.recorder.noRecordingYet);
      return;
    }

    const cleanName = (soundName || 'untitled').trim().replace(/[^a-zA-Z0-9_\u3131-\uD79D]/g, '_') || 'untitled';
    setIsProcessing(true);
    try {
      const worker = getPraatWorker();
      const soundId = await worker.createSound(
        captured.samples,
        captured.numSamples,
        captured.channels,
        captured.sampleRate,
        cleanName
      );
      const info = await worker.getSoundInfo(soundId);

      setObjects((prev) => [
        ...prev,
        {
          id: info.id,
          className: 'Sound',
          name: info.name,
          duration: info.duration,
          sampleRate: info.sampleRate,
          numChannels: info.numChannels,
          numSamples: info.numSamples,
          createdAt: Date.now(),
        },
      ]);
      setSelectedIds([info.id]);
      setStatusMessage(`${t.status.soundRecorded}: Sound ${info.name}`);

      if (closeAfterSave) {
        await handleClose();
      }
    } catch (err) {
      console.error('Failed to save recorded sound:', err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const peakPercent = Math.min(100, Math.round(meter.peak * 100));
  const meterBarColor =
    meter.peak >= 0.85 ? 'bg-red-500' : meter.peak >= 0.5 ? 'bg-amber-400' : 'bg-emerald-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <h3 className="text-sm font-semibold text-slate-800">
              {channels === 1 ? t.recorder.monoTitle : t.recorder.stereoTitle}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {errorMsg && (
            <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Device, Channels & Sampling Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {t.recorder.channels}:
              </label>
              <div className="flex rounded border border-slate-300 overflow-hidden text-xs">
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => void handleSwitchConfig(1, sampleRate, selectedDeviceId)}
                  className={`flex-1 py-1.5 font-medium transition-colors ${
                    channels === 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  } disabled:opacity-50`}
                >
                  {t.recorder.mono}
                </button>
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => void handleSwitchConfig(2, sampleRate, selectedDeviceId)}
                  className={`flex-1 py-1.5 font-medium border-l border-slate-300 transition-colors ${
                    channels === 2
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  } disabled:opacity-50`}
                >
                  {t.recorder.stereo}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {t.recorder.sampleRate}:
              </label>
              <select
                disabled={isRecording}
                value={sampleRate}
                onChange={(e) =>
                  void handleSwitchConfig(channels, Number(e.target.value), selectedDeviceId)
                }
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {SAMPLE_RATES.map((sr) => (
                  <option key={sr} value={sr}>
                    {sr} {t.units.hz}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {t.recorder.inputSource}:
              </label>
              <select
                disabled={isRecording}
                value={selectedDeviceId}
                onChange={(e) =>
                  void handleSwitchConfig(channels, sampleRate, e.target.value)
                }
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="default">{t.recorder.defaultMicrophone}</option>
                {devices
                  .filter((d) => d.deviceId && d.deviceId !== 'default')
                  .map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Praat Level Meter + Waveform Display */}
          <div className="space-y-2 bg-slate-50 p-3 rounded border border-slate-200">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">{t.recorder.meter}</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-slate-600">
                  {t.recorder.duration}: <strong>{meter.duration.toFixed(2)} s</strong>
                </span>
                {meter.clipped && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded">
                    {t.recorder.clipping}
                  </span>
                )}
              </div>
            </div>

            {/* VU Bar */}
            <div className="w-full h-4 bg-slate-800 rounded overflow-hidden p-0.5">
              <div
                className={`h-full rounded-sm transition-all duration-75 ${meterBarColor}`}
                style={{ width: `${peakPercent}%` }}
              />
            </div>

            {/* Live Waveform Canvas */}
            <canvas
              ref={canvasRef}
              width={480}
              height={84}
              className="w-full h-[84px] rounded border border-slate-700 bg-slate-900 block"
            />

            <div className="text-[11px] text-slate-500">
              {isRecording ? t.recorder.recordingInProgress : t.recorder.readyToRecord}
            </div>
          </div>

          {/* Transport Controls: Record / Stop / Play */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isRecording}
              onClick={() => void handleRecord()}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded shadow-sm transition-colors"
            >
              ● {t.recorder.record}
            </button>
            <button
              type="button"
              disabled={!isRecording && !isPlayingPreview}
              onClick={handleStop}
              className="px-4 py-1.5 text-xs font-semibold text-slate-800 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 rounded transition-colors"
            >
              ■ {t.recorder.stop}
            </button>
            <button
              type="button"
              disabled={isRecording || meter.numSamples === 0}
              onClick={() => void handlePlayPreview()}
              className="px-4 py-1.5 text-xs font-semibold text-slate-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 disabled:opacity-40 rounded transition-colors"
            >
              ▶ {t.recorder.play}
            </button>

            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs font-medium text-slate-700">{t.recorder.name}:</label>
              <input
                type="text"
                value={soundName}
                onChange={(e) => setSoundName(e.target.value)}
                className="w-36 px-2.5 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Footer Buttons matching desktop Praat SoundRecorder */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void handleClose()}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors"
          >
            {t.dialogs.close}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={meter.numSamples === 0 && !isRecording}
              onClick={() => void handleSave(false)}
              className="px-3.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-40 transition-colors"
            >
              {t.recorder.saveToList}
            </button>
            <button
              type="button"
              disabled={meter.numSamples === 0 && !isRecording}
              onClick={() => void handleSave(true)}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 shadow-sm transition-colors"
            >
              {t.recorder.saveToListAndClose}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
