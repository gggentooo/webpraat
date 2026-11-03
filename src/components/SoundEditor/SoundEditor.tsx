import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { useAudio } from '../../hooks/useAudio';
import { getPraatWorker } from '../../utils/audio';
import { WaveformCanvas } from './WaveformCanvas';
import { SpectrogramCanvas } from './SpectrogramCanvas';
import type {
  SpectrogramData,
  PitchTrack,
  FormantTrack,
  IntensityTrack,
} from '../../types/wasm';
import type { PraatObject } from '../../types/praat';

export interface SoundEditorProps {
  sound: PraatObject;
  onClose?: () => void;
}

export const SoundEditor: React.FC<SoundEditorProps> = ({ sound, onClose }) => {
  const { t } = useI18n();

  // Audio samples & metadata
  const [channels, setChannels] = useState<Float64Array[]>([]);
  const [loading, setLoading] = useState(true);

  // Analysis data from WASM
  const [spectrogram, setSpectrogram] = useState<SpectrogramData | null>(null);
  const [pitch, setPitch] = useState<PitchTrack | null>(null);
  const [formants, setFormants] = useState<FormantTrack | null>(null);
  const [intensity, setIntensity] = useState<IntensityTrack | null>(null);

  // Display toggles
  const [showSpectrogram, setShowSpectrogram] = useState(true);
  const [showPitch, setShowPitch] = useState(true);
  const [showFormants, setShowFormants] = useState(true);
  const [showIntensity, setShowIntensity] = useState(false);
  const [colorMap, setColorMap] = useState<'greyscale' | 'colour'>('greyscale');

  // Time Viewport & Zoom State
  const duration = sound.duration || 1.0;
  const sampleRate = sound.sampleRate || 44100;

  const [tmin, setTmin] = useState(0);
  const [tmax, setTmax] = useState(duration);
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [zoomHistory, setZoomHistory] = useState<Array<[number, number]>>([]);

  // Audio Playback Hook
  const audioOptions = useMemoAudioOptions(channels, sampleRate, duration);
  const { isPlaying, playheadTime, play, stop, seek } = useAudio(audioOptions);

  function useMemoAudioOptions(
    chList: Float64Array[],
    fs: number,
    dur: number
  ) {
    return React.useMemo(() => {
      if (chList.length === 0) return null;
      return { sampleRate: fs, channels: chList, duration: dur };
    }, [chList, fs, dur]);
  }

  // Load sound channel samples and run initial DSP analysis
  useEffect(() => {
    let active = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const worker = getPraatWorker();
        const info = await worker.getSoundInfo(sound.id);
        const chData: Float64Array[] = [];

        for (let ch = 1; ch <= info.numChannels; ++ch) {
          const samples = await worker.getSoundChannelSamples(sound.id, ch);
          chData.push(samples);
        }

        if (!active) return;
        setChannels(chData);
        setTmin(0);
        setTmax(info.duration);
        setSelection(null);
        setZoomHistory([]);

        // Perform parallel analysis in worker
        const analysis = await worker.analyzeSoundForEditor(sound.id, {
          spectrogram: true,
          pitch: true,
          formant: true,
          intensity: true,
        });

        if (!active) return;
        if (analysis.spectrogram) setSpectrogram(analysis.spectrogram);
        if (analysis.pitch) setPitch(analysis.pitch);
        if (analysis.formants) setFormants(analysis.formants);
        if (analysis.intensity) setIntensity(analysis.intensity);
      } catch (err) {
        console.error('Failed to load sound data in editor:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
      stop();
    };
  }, [sound.id, stop]);

  // Viewport Zoom Functions
  const applyZoom = useCallback(
    (newMin: number, newMax: number) => {
      if (newMax - newMin < 0.001) return;
      const clampedMin = Math.max(0, Math.min(newMin, duration - 0.001));
      const clampedMax = Math.min(duration, Math.max(newMax, clampedMin + 0.001));
      setZoomHistory((prev) => [...prev, [tmin, tmax]]);
      setTmin(clampedMin);
      setTmax(clampedMax);
    },
    [tmin, tmax, duration]
  );

  const zoomAll = () => {
    applyZoom(0, duration);
  };

  const zoomIn = () => {
    const center =
      selection && Math.abs(selection[1] - selection[0]) > 0.001
        ? (selection[0] + selection[1]) / 2
        : (tmin + tmax) / 2;
    const halfSpan = (tmax - tmin) / 4;
    applyZoom(center - halfSpan, center + halfSpan);
  };

  const zoomOut = () => {
    const center = (tmin + tmax) / 2;
    const halfSpan = tmax - tmin;
    applyZoom(center - halfSpan, center + halfSpan);
  };

  const zoomSel = () => {
    if (!selection) return;
    const s0 = Math.min(selection[0], selection[1]);
    const s1 = Math.max(selection[0], selection[1]);
    if (s1 - s0 > 0.0005) {
      applyZoom(s0, s1);
    }
  };

  const zoomBak = () => {
    if (zoomHistory.length === 0) return;
    const prev = zoomHistory[zoomHistory.length - 1];
    setZoomHistory((h) => h.slice(0, -1));
    setTmin(prev[0]);
    setTmax(prev[1]);
  };

  // Selection handlers
  const handleSelect = (start: number, end: number) => {
    const sStart = Math.max(0, Math.min(start, duration));
    const sEnd = Math.max(0, Math.min(end, duration));
    setSelection([sStart, sEnd]);
  };

  const handleSeek = (time: number) => {
    const clamped = Math.max(0, Math.min(time, duration));
    seek(clamped);
  };

  // Keyboard Navigation: Space / Tab / Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          stop();
        } else {
          if (selection && Math.abs(selection[1] - selection[0]) > 0.001) {
            play(Math.min(selection[0], selection[1]), Math.max(selection[0], selection[1]));
          } else {
            play(tmin, tmax);
          }
        }
      } else if (e.code === 'Tab') {
        e.preventDefault();
        if (isPlaying) {
          stop();
        } else {
          play(tmin, tmax);
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        setSelection(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, play, stop, selection, tmin, tmax]);

  // Praat playback bar durations
  const visibleDuration = Math.max(0, tmax - tmin);
  const selectionDuration = selection
    ? Math.max(0, Math.abs(selection[1] - selection[0]))
    : 0;

  return (
    <div className="flex h-full w-full flex-col bg-white text-slate-800 text-xs select-none">
      {/* 1. Editor Header / Toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-300 bg-slate-100 px-3">
        {/* Left: Toggles matching Praat Analysis Views */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setShowSpectrogram((v) => !v)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
              showSpectrogram
                ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {t.editor.showSpectrogram}
          </button>

          <button
            type="button"
            onClick={() => setShowPitch((v) => !v)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
              showPitch
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {t.editor.showPitch}
          </button>

          <button
            type="button"
            onClick={() => setShowFormants((v) => !v)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
              showFormants
                ? 'bg-red-600 text-white border-red-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {t.editor.showFormants}
          </button>

          <button
            type="button"
            onClick={() => setShowIntensity((v) => !v)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
              showIntensity
                ? 'bg-green-600 text-white border-green-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {t.editor.showIntensity}
          </button>

          <div className="h-4 border-l border-slate-300 mx-1 shrink-0" />

          {/* Colour vs Greyscale toggle */}
          <button
            type="button"
            onClick={() =>
              setColorMap((prev) => (prev === 'greyscale' ? 'colour' : 'greyscale'))
            }
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 shadow-xs whitespace-nowrap shrink-0"
          >
            {colorMap === 'greyscale' ? t.editor.colour : t.editor.greyscale}
          </button>
        </div>

        {/* Right: Sound info & Close */}
        <div className="flex items-center space-x-3">
          <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
            {sound.name} | {sampleRate} {t.units.hz} | {duration.toFixed(3)}{' '}
            {t.units.seconds}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 shadow-xs whitespace-nowrap shrink-0"
            >
              {t.editor.closeEditor}
            </button>
          )}
        </div>
      </div>

      {/* 2. Canvases Body (Waveform on top, Spectrogram on bottom) */}
      <div className="flex-1 flex flex-col min-h-0 bg-white relative">
        {loading ? (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <span className="animate-spin inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent mr-2" />
            <span>{t.status.loading}</span>
          </div>
        ) : (
          <>
            {/* Top: Waveform Canvas */}
            <div className="flex-1 border-b border-slate-300 relative min-h-0">
              <WaveformCanvas
                channels={channels}
                sampleRate={sampleRate}
                tmin={tmin}
                tmax={tmax}
                selection={selection}
                playheadTime={playheadTime}
                onSelect={handleSelect}
                onSeek={handleSeek}
              />
            </div>

            {/* Bottom: Spectrogram Canvas */}
            <div className="flex-1 relative min-h-0 bg-white">
              <SpectrogramCanvas
                spectrogram={spectrogram}
                pitch={pitch}
                formants={formants}
                intensity={intensity}
                showSpectrogram={showSpectrogram}
                showPitch={showPitch}
                showFormants={showFormants}
                showIntensity={showIntensity}
                colorMap={colorMap}
                tmin={tmin}
                tmax={tmax}
                selection={selection}
                playheadTime={playheadTime}
                onSelect={handleSelect}
                onSeek={handleSeek}
              />
            </div>
          </>
        )}
      </div>

      {/* 3. Bottom Time Axis Ruler */}
      <div className="h-4 shrink-0 flex items-center justify-between border-t border-slate-300 bg-slate-100 px-2 font-mono text-[10px] text-slate-500">
        <span>{tmin.toFixed(4)} s</span>
        <span>{((tmin + tmax) / 2).toFixed(4)} s</span>
        <span>{tmax.toFixed(4)} s</span>
      </div>

      {/* 4. Praat Playback & Zoom Bar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-slate-300 bg-slate-200 px-2 overflow-x-auto overflow-y-hidden">
        {/* Left: Praat-style 3 Playback Buttons */}
        <div className="flex items-center space-x-1.5 font-mono text-[11px] shrink-0">
          {/* 1. Visible Window Play button */}
          <button
            type="button"
            title={`${t.editor.playWindow} (${tmin.toFixed(4)} - ${tmax.toFixed(4)} s)`}
            onClick={() => {
              if (isPlaying) stop();
              else play(tmin, tmax);
            }}
            className="flex items-center rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-50 active:bg-slate-200 shadow-xs whitespace-nowrap shrink-0"
          >
            <span className="text-slate-400 mr-1.5">▶</span>
            <span className="font-semibold">{visibleDuration.toFixed(4)}</span>
            <span className="text-[9px] text-slate-400 ml-1">({t.editor.visible})</span>
          </button>

          {/* 2. Selection Range Play button */}
          {selectionDuration > 0.0005 && (
            <button
              type="button"
              title={`${t.editor.playSelection} (${selectionDuration.toFixed(4)} s)`}
              onClick={() => {
                if (isPlaying) stop();
                else if (selection) {
                  play(
                    Math.min(selection[0], selection[1]),
                    Math.max(selection[0], selection[1])
                  );
                }
              }}
              className="flex items-center rounded border border-blue-400 bg-blue-50 px-2 py-0.5 text-blue-800 hover:bg-blue-100 active:bg-blue-200 shadow-xs whitespace-nowrap shrink-0"
            >
              <span className="text-blue-500 mr-1.5">▶</span>
              <span className="font-semibold">{selectionDuration.toFixed(4)}</span>
              <span className="text-[9px] text-blue-500 ml-1">({t.editor.selection})</span>
            </button>
          )}

          {/* 3. Total Sound Play button */}
          <button
            type="button"
            title={`Play all (${duration.toFixed(4)} s)`}
            onClick={() => {
              if (isPlaying) stop();
              else play(0, duration);
            }}
            className="flex items-center rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-50 active:bg-slate-200 shadow-xs whitespace-nowrap shrink-0"
          >
            <span className="text-slate-400 mr-1.5">▶</span>
            <span className="font-semibold">{duration.toFixed(4)}</span>
            <span className="text-[9px] text-slate-400 ml-1">({t.editor.total})</span>
          </button>
        </div>

        {/* Right: Praat Standard Zoom Buttons (all, in, out, sel, bak) */}
        <div className="flex items-center space-x-1 font-semibold text-[11px] shrink-0">
          <button
            type="button"
            onClick={zoomAll}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-50 active:bg-slate-200 shadow-xs whitespace-nowrap shrink-0"
          >
            {t.editor.zoomAll}
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-50 active:bg-slate-200 shadow-xs whitespace-nowrap shrink-0"
          >
            {t.editor.zoomIn}
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-50 active:bg-slate-200 shadow-xs whitespace-nowrap shrink-0"
          >
            {t.editor.zoomOut}
          </button>
          <button
            type="button"
            disabled={!selection || selectionDuration <= 0.0005}
            onClick={zoomSel}
            className={`rounded border px-2 py-0.5 shadow-xs whitespace-nowrap shrink-0 ${
              selection && selectionDuration > 0.0005
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {t.editor.zoomSel}
          </button>
          <button
            type="button"
            disabled={zoomHistory.length === 0}
            onClick={zoomBak}
            className={`rounded border px-2 py-0.5 shadow-xs whitespace-nowrap shrink-0 ${
              zoomHistory.length > 0
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {t.editor.zoomBak}
          </button>

          <div className="h-4 border-l border-slate-300 mx-0.5 shrink-0" />

          {/* Undo button */}
          <button
            type="button"
            disabled
            title="Undo (Ctrl+Z / ⌘Z)"
            className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-400 cursor-not-allowed shadow-xs whitespace-nowrap shrink-0"
          >
            {t.editor.undo}
          </button>

          {/* Redo button */}
          <button
            type="button"
            disabled
            title="Redo (Ctrl+Y / ⌘⇧Z)"
            className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-400 cursor-not-allowed shadow-xs whitespace-nowrap shrink-0"
          >
            {t.editor.redo}
          </button>
        </div>
      </div>
    </div>
  );
};
