import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { useAudio } from '../../hooks/useAudio';
import { getPraatWorker, downloadBlob } from '../../utils/audio';
import {
  serializeTextGrid,
  insertBoundaryInTier,
  moveBoundaryInTier,
  removeBoundaryFromTier,
  setIntervalTextInTier,
} from '../../utils/textgrid';
import { WaveformCanvas } from '../SoundEditor/WaveformCanvas';
import {
  TextGridTiersCanvas,
  TEXTGRID_TIER_LABEL_WIDTH_PX,
} from './TextGridTiersCanvas';
import { IPAPalette } from './IPAPalette';
import type {
  TextGridData,
  IntervalTier,
  PointTier,
  PraatObject,
} from '../../types/praat';

export interface TextGridEditorProps {
  sound?: PraatObject | null;
  textGrid: PraatObject;
  onClose?: () => void;
}

export const TextGridEditor: React.FC<TextGridEditorProps> = ({
  sound,
  textGrid,
  onClose,
}) => {
  const { t } = useI18n();

  // Audio samples & metadata
  const [channels, setChannels] = useState<Float64Array[]>([]);
  const [loading, setLoading] = useState(true);

  // TextGrid in-memory state
  const [gridData, setGridData] = useState<TextGridData | null>(null);
  const [selectedTierIndex, setSelectedTierIndex] = useState<number>(0);
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState<number | null>(null);

  // Active interval text input
  const [activeText, setActiveText] = useState('');

  // Undo / Redo history stacks
  interface TextGridHistoryState {
    gridData: TextGridData;
    selectedTierIndex: number;
    selectedIntervalIndex: number | null;
    activeText: string;
    selection: [number, number] | null;
  }

  const [undoStack, setUndoStack] = useState<TextGridHistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<TextGridHistoryState[]>([]);

  const gridDataRef = useRef<TextGridData | null>(null);
  gridDataRef.current = gridData;

  const selectedTierIndexRef = useRef(selectedTierIndex);
  selectedTierIndexRef.current = selectedTierIndex;

  const selectedIntervalIndexRef = useRef(selectedIntervalIndex);
  selectedIntervalIndexRef.current = selectedIntervalIndex;

  const activeTextRef = useRef(activeText);
  activeTextRef.current = activeText;

  const preDragStateRef = useRef<TextGridHistoryState | null>(null);
  const textEditOriginStateRef = useRef<TextGridHistoryState | null>(null);
  const textEditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep waveform & time ruler right-edge aligned if tiers scroll container shows a classic scrollbar
  const tiersScrollRef = useRef<HTMLDivElement>(null);
  const [tiersScrollbarWidth, setTiersScrollbarWidth] = useState(0);

  useEffect(() => {
    const el = tiersScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const updateScrollbarWidth = () => {
      setTiersScrollbarWidth(Math.max(0, el.offsetWidth - el.clientWidth));
    };

    updateScrollbarWidth();
    const observer = new ResizeObserver(updateScrollbarWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, gridData?.tiers.length]);

  // Time Viewport & Zoom State
  const duration = sound?.duration || gridData?.xmax || 1.0;
  const sampleRate = sound?.sampleRate || 44100;

  const [tmin, setTmin] = useState(0);
  const [tmax, setTmax] = useState(duration);
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [zoomHistory, setZoomHistory] = useState<Array<[number, number]>>([]);

  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  // Audio Playback Hook
  const audioOptions = React.useMemo(() => {
    if (channels.length === 0) return null;
    return { sampleRate, channels, duration };
  }, [channels, sampleRate, duration]);

  const { isPlaying, playheadTime, play, stop, seek } = useAudio(audioOptions);

  // Load sound samples and TextGrid data
  useEffect(() => {
    let active = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const worker = getPraatWorker();

        // 1. Load TextGrid data
        const tgData = await worker.getTextGridData(textGrid.id);
        if (!active) return;
        setGridData(tgData);
        setTmin(tgData.xmin);
        setTmax(tgData.xmax);

        // 2. Load Sound samples if paired with Sound
        if (sound) {
          const info = await worker.getSoundInfo(sound.id);
          const chData: Float64Array[] = [];
          for (let ch = 1; ch <= info.numChannels; ++ch) {
            const samples = await worker.getSoundChannelSamples(sound.id, ch);
            chData.push(samples);
          }
          if (!active) return;
          setChannels(chData);
        }
      } catch (err) {
        console.error('Failed to load TextGrid data in editor:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
      stop();
    };
  }, [sound, textGrid.id, stop]);

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

  const zoomAll = () => applyZoom(0, duration);
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

  // TextGrid History & Worker Sync Helpers
  const captureCurrentState = useCallback((): TextGridHistoryState | null => {
    if (!gridDataRef.current) return null;
    return {
      gridData: structuredClone(gridDataRef.current),
      selectedTierIndex: selectedTierIndexRef.current,
      selectedIntervalIndex: selectedIntervalIndexRef.current,
      activeText: activeTextRef.current,
      selection: selectionRef.current ? [...selectionRef.current] : null,
    };
  }, []);

  const syncGridToWorker = useCallback(
    async (data: TextGridData) => {
      try {
        const worker = getPraatWorker();
        await worker.updateTextGridData(textGrid.id, data);
      } catch (err) {
        console.warn('Worker sync failed:', err);
      }
    },
    [textGrid.id]
  );

  const pushUndoState = useCallback((stateToPush: TextGridHistoryState) => {
    setUndoStack((prev) => {
      const next = [...prev, stateToPush];
      if (next.length > 50) return next.slice(next.length - 50);
      return next;
    });
    setRedoStack([]);
  }, []);

  const commitPendingTextEdit = useCallback(() => {
    if (textEditTimerRef.current) {
      clearTimeout(textEditTimerRef.current);
      textEditTimerRef.current = null;
    }
    if (textEditOriginStateRef.current) {
      const origin = textEditOriginStateRef.current;
      textEditOriginStateRef.current = null;
      if (
        gridDataRef.current &&
        JSON.stringify(origin.gridData) !== JSON.stringify(gridDataRef.current)
      ) {
        pushUndoState(origin);
        syncGridToWorker(gridDataRef.current);
      }
    }
  }, [pushUndoState, syncGridToWorker]);

  const handleUndo = useCallback(() => {
    commitPendingTextEdit();

    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const targetState = prevUndo[prevUndo.length - 1];
      const newUndo = prevUndo.slice(0, -1);

      const currentState = captureCurrentState();
      if (currentState) {
        setRedoStack((prevRedo) => [...prevRedo, currentState]);
      }

      setGridData(targetState.gridData);
      setSelectedTierIndex(targetState.selectedTierIndex);
      setSelectedIntervalIndex(targetState.selectedIntervalIndex);
      setActiveText(targetState.activeText);
      setSelection(targetState.selection);
      syncGridToWorker(targetState.gridData);

      return newUndo;
    });
  }, [commitPendingTextEdit, captureCurrentState, syncGridToWorker]);

  const handleRedo = useCallback(() => {
    commitPendingTextEdit();

    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const targetState = prevRedo[prevRedo.length - 1];
      const newRedo = prevRedo.slice(0, -1);

      const currentState = captureCurrentState();
      if (currentState) {
        setUndoStack((prevUndo) => [...prevUndo, currentState]);
      }

      setGridData(targetState.gridData);
      setSelectedTierIndex(targetState.selectedTierIndex);
      setSelectedIntervalIndex(targetState.selectedIntervalIndex);
      setActiveText(targetState.activeText);
      setSelection(targetState.selection);
      syncGridToWorker(targetState.gridData);

      return newRedo;
    });
  }, [commitPendingTextEdit, captureCurrentState, syncGridToWorker]);

  // Dragging boundary & point lifecycle
  const handleDragBoundaryStart = useCallback(() => {
    commitPendingTextEdit();
    preDragStateRef.current = captureCurrentState();
  }, [commitPendingTextEdit, captureCurrentState]);

  const handleDragBoundaryEnd = useCallback(() => {
    if (preDragStateRef.current && gridDataRef.current) {
      if (
        JSON.stringify(preDragStateRef.current.gridData) !==
        JSON.stringify(gridDataRef.current)
      ) {
        pushUndoState(preDragStateRef.current);
        syncGridToWorker(gridDataRef.current);
      }
    }
    preDragStateRef.current = null;
  }, [pushUndoState, syncGridToWorker]);

  const handleDragPointStart = useCallback(() => {
    commitPendingTextEdit();
    preDragStateRef.current = captureCurrentState();
  }, [commitPendingTextEdit, captureCurrentState]);

  const handleDragPointEnd = useCallback(() => {
    if (preDragStateRef.current && gridDataRef.current) {
      if (
        JSON.stringify(preDragStateRef.current.gridData) !==
        JSON.stringify(gridDataRef.current)
      ) {
        pushUndoState(preDragStateRef.current);
        syncGridToWorker(gridDataRef.current);
      }
    }
    preDragStateRef.current = null;
  }, [pushUndoState, syncGridToWorker]);

  // TextGrid Annotation Handlers
  const handleSelectInterval = (tierIndex: number, intervalIndex: number) => {
    commitPendingTextEdit();
    setSelectedTierIndex(tierIndex);
    setSelectedIntervalIndex(intervalIndex);

    if (gridData && gridData.tiers[tierIndex]?.type === 'IntervalTier') {
      const tier = gridData.tiers[tierIndex] as IntervalTier;
      const interval = tier.intervals[intervalIndex];
      if (interval) {
        setActiveText(interval.text);
        setSelection([interval.xmin, interval.xmax]);
      }
    }
  };

  const handleAddBoundary = async (tierIndex: number, time: number) => {
    if (!gridData) return;
    const tier = gridData.tiers[tierIndex];
    if (!tier || tier.type !== 'IntervalTier') return;

    commitPendingTextEdit();
    const stateBefore = captureCurrentState();
    if (stateBefore) pushUndoState(stateBefore);

    const updatedTier = insertBoundaryInTier(tier as IntervalTier, time);
    const updatedTiers = [...gridData.tiers];
    updatedTiers[tierIndex] = updatedTier;
    const newGrid = { ...gridData, tiers: updatedTiers };
    setGridData(newGrid);

    syncGridToWorker(newGrid);
  };

  const handleMoveBoundary = async (
    tierIndex: number,
    intervalIndex: number,
    newTime: number
  ) => {
    if (!gridData) return;
    const tier = gridData.tiers[tierIndex];
    if (!tier || tier.type !== 'IntervalTier') return;

    const updatedTier = moveBoundaryInTier(tier as IntervalTier, intervalIndex, newTime);
    const updatedTiers = [...gridData.tiers];
    updatedTiers[tierIndex] = updatedTier;
    setGridData({ ...gridData, tiers: updatedTiers });
  };

  const handleRemoveBoundary = async (tierIndex: number, intervalIndex: number) => {
    if (!gridData) return;
    const tier = gridData.tiers[tierIndex];
    if (!tier || tier.type !== 'IntervalTier') return;

    commitPendingTextEdit();
    const stateBefore = captureCurrentState();
    if (stateBefore) pushUndoState(stateBefore);

    const updatedTier = removeBoundaryFromTier(tier as IntervalTier, intervalIndex);
    const updatedTiers = [...gridData.tiers];
    updatedTiers[tierIndex] = updatedTier;
    const newGrid = { ...gridData, tiers: updatedTiers };
    setGridData(newGrid);

    syncGridToWorker(newGrid);
  };

  const handleSetIntervalText = async (
    tierIndex: number,
    intervalIndex: number,
    text: string
  ) => {
    if (!gridData) return;
    const tier = gridData.tiers[tierIndex];
    if (!tier || tier.type !== 'IntervalTier') return;

    if (!textEditOriginStateRef.current) {
      textEditOriginStateRef.current = captureCurrentState();
    }

    const updatedTier = setIntervalTextInTier(tier as IntervalTier, intervalIndex, text);
    const updatedTiers = [...gridData.tiers];
    updatedTiers[tierIndex] = updatedTier;
    const newGrid = { ...gridData, tiers: updatedTiers };
    setGridData(newGrid);
    setActiveText(text);

    if (textEditTimerRef.current) clearTimeout(textEditTimerRef.current);
    textEditTimerRef.current = setTimeout(() => {
      commitPendingTextEdit();
    }, 600);
  };

  const handleAddPoint = async (tierIndex: number, time: number) => {
    if (!gridData) return;
    const tier = gridData.tiers[tierIndex];
    if (!tier || tier.type !== 'TextTier') return;

    commitPendingTextEdit();
    const stateBefore = captureCurrentState();
    if (stateBefore) pushUndoState(stateBefore);

    const newPoints = [...(tier as PointTier).points, { time, mark: '' }].sort(
      (a, b) => a.time - b.time
    );
    const updatedTiers = [...gridData.tiers];
    updatedTiers[tierIndex] = { ...tier, points: newPoints };
    const newGrid = { ...gridData, tiers: updatedTiers };
    setGridData(newGrid);

    syncGridToWorker(newGrid);
  };

  const handleMovePoint = async (
    tierIndex: number,
    pointIndex: number,
    newTime: number
  ) => {
    if (!gridData) return;
    const tier = gridData.tiers[tierIndex];
    if (!tier || tier.type !== 'TextTier') return;

    const newPoints = [...(tier as PointTier).points];
    newPoints[pointIndex] = { ...newPoints[pointIndex], time: newTime };
    const updatedTiers = [...gridData.tiers];
    updatedTiers[tierIndex] = { ...tier, points: newPoints };
    setGridData({ ...gridData, tiers: updatedTiers });
  };

  const handleSetPointText = async (
    tierIndex: number,
    pointIndex: number,
    text: string
  ) => {
    if (!gridData) return;
    const tier = gridData.tiers[tierIndex];
    if (!tier || tier.type !== 'TextTier') return;

    commitPendingTextEdit();
    const stateBefore = captureCurrentState();
    if (stateBefore) pushUndoState(stateBefore);

    const newPoints = [...(tier as PointTier).points];
    newPoints[pointIndex] = { ...newPoints[pointIndex], mark: text };
    const updatedTiers = [...gridData.tiers];
    updatedTiers[tierIndex] = { ...tier, points: newPoints };
    const newGrid = { ...gridData, tiers: updatedTiers };
    setGridData(newGrid);

    syncGridToWorker(newGrid);
  };

  // IPA palette symbol insertion
  const handleInsertIPA = (char: string) => {
    commitPendingTextEdit();
    const newText = activeText + char;
    setActiveText(newText);
    if (selectedIntervalIndex !== null) {
      handleSetIntervalText(selectedTierIndex, selectedIntervalIndex, newText);
    }
  };

  // Export TextGrid as downloadable file
  const handleExportTextGrid = () => {
    commitPendingTextEdit();
    if (!gridData) return;
    const serialized = serializeTextGrid(gridData);
    const blob = new Blob([serialized], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${textGrid.name}.TextGrid`);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      const isUndoKey =
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'z';

      const isRedoKey =
        ((e.metaKey || e.ctrlKey) && !e.altKey && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'y');

      if (isUndoKey && !isInput) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (isRedoKey && !isInput) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (isInput) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) stop();
        else {
          if (selection && Math.abs(selection[1] - selection[0]) > 0.001) {
            play(Math.min(selection[0], selection[1]), Math.max(selection[0], selection[1]));
          } else {
            play(tmin, tmax);
          }
        }
      } else if (e.code === 'Tab') {
        e.preventDefault();
        if (isPlaying) stop();
        else play(tmin, tmax);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        setSelection(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, isPlaying, play, stop, selection, tmin, tmax]);

  const visibleDuration = Math.max(0, tmax - tmin);
  const selectionDuration = selection
    ? Math.max(0, Math.abs(selection[1] - selection[0]))
    : 0;

  return (
    <div className="flex h-full w-full flex-col bg-white text-slate-800 text-xs select-none">
      {/* 1. Header Toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-300 bg-slate-100 px-3">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-700 text-sm">
            {t.editor.textGridEditorTitle}: {textGrid.name}
          </span>
          {sound && (
            <span className="text-[11px] text-slate-500 font-mono">
              ({sound.name})
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Export TextGrid Button */}
          <button
            type="button"
            onClick={handleExportTextGrid}
            className="rounded border border-blue-600 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 active:bg-blue-200 shadow-xs"
          >
            Export .TextGrid
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              {t.editor.closeEditor}
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Active Interval Text & IPA Palette */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-300 bg-slate-50 px-3 py-1 space-x-3">
        <div className="flex flex-1 items-center space-x-2">
          <span className="text-[11px] font-semibold text-slate-600 shrink-0">
            {t.editor.selection}:
          </span>
          <input
            type="text"
            value={activeText}
            placeholder="Type interval label or click IPA symbols below..."
            onBlur={commitPendingTextEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitPendingTextEdit();
                e.currentTarget.blur();
              }
            }}
            onChange={(e) => {
              setActiveText(e.target.value);
              if (selectedIntervalIndex !== null) {
                handleSetIntervalText(
                  selectedTierIndex,
                  selectedIntervalIndex,
                  e.target.value
                );
              }
            }}
            className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-serif text-slate-800 outline-hidden focus:border-blue-500 shadow-inner"
          />
        </div>

        {/* IPA Palette toolbar */}
        <div className="shrink-0">
          <IPAPalette onInsert={handleInsertIPA} />
        </div>
      </div>

      {/* 3. Canvases Body (Waveform top, TextGrid tiers directly beneath) */}
      <div className="flex-1 flex flex-col min-h-0 bg-white relative">
        {loading ? (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <span className="animate-spin inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent mr-2" />
            <span>{t.status.loading}</span>
          </div>
        ) : (
          <>
            {/* Top: Waveform View (if sound is present) */}
            {sound && channels.length > 0 && (
              <div
                style={
                  tiersScrollbarWidth > 0
                    ? { paddingRight: `${tiersScrollbarWidth}px` }
                    : undefined
                }
                className="h-44 border-b border-slate-300 relative flex min-h-0 shrink-0 bg-slate-100"
              >
                {/* Left margin equal to TextGrid tier label column width */}
                <div
                  style={{ width: `${TEXTGRID_TIER_LABEL_WIDTH_PX}px` }}
                  className="shrink-0 h-full border-r border-slate-300 bg-slate-100"
                  aria-hidden="true"
                />
                <div className="flex-1 h-full relative min-w-0 bg-white">
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
              </div>
            )}

            {/* Bottom: Stacked Tiers directly beneath waveform view */}
            <div ref={tiersScrollRef} className="flex-1 overflow-y-auto min-h-0 bg-white">
              {gridData && (
                <TextGridTiersCanvas
                  textGrid={gridData}
                  tmin={tmin}
                  tmax={tmax}
                  selection={selection}
                  selectedTierIndex={selectedTierIndex}
                  selectedIntervalIndex={selectedIntervalIndex}
                  tierLabelWidthPx={TEXTGRID_TIER_LABEL_WIDTH_PX}
                  onSelectInterval={handleSelectInterval}
                  onAddBoundary={handleAddBoundary}
                  onMoveBoundary={handleMoveBoundary}
                  onRemoveBoundary={handleRemoveBoundary}
                  onSetIntervalText={handleSetIntervalText}
                  onAddPoint={handleAddPoint}
                  onMovePoint={handleMovePoint}
                  onSetPointText={handleSetPointText}
                  onDragBoundaryStart={handleDragBoundaryStart}
                  onDragBoundaryEnd={handleDragBoundaryEnd}
                  onDragPointStart={handleDragPointStart}
                  onDragPointEnd={handleDragPointEnd}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* 4. Bottom Time Ruler */}
      <div
        style={
          tiersScrollbarWidth > 0
            ? { paddingRight: `${tiersScrollbarWidth}px` }
            : undefined
        }
        className="h-4 shrink-0 flex items-center border-t border-slate-300 bg-slate-100 font-mono text-[10px] text-slate-500"
      >
        <div
          style={{ width: `${TEXTGRID_TIER_LABEL_WIDTH_PX}px` }}
          className="h-full shrink-0 border-r border-slate-300 bg-slate-100"
          aria-hidden="true"
        />
        <div className="flex flex-1 items-center justify-between px-2 min-w-0">
          <span>{tmin.toFixed(4)} s</span>
          <span>{((tmin + tmax) / 2).toFixed(4)} s</span>
          <span>{tmax.toFixed(4)} s</span>
        </div>
      </div>

      {/* 5. Praat Playback & Zoom Bar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-slate-300 bg-slate-200 px-2">
        {/* Playback buttons */}
        <div className="flex items-center space-x-1.5 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => {
              if (isPlaying) stop();
              else play(tmin, tmax);
            }}
            className="flex items-center rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-50 active:bg-slate-200 shadow-xs"
          >
            <span className="text-slate-400 mr-1.5">▶</span>
            <span className="font-semibold">{visibleDuration.toFixed(4)}</span>
            <span className="text-[9px] text-slate-400 ml-1">({t.editor.visible})</span>
          </button>

          {selectionDuration > 0.0005 && (
            <button
              type="button"
              onClick={() => {
                if (isPlaying) stop();
                else if (selection) {
                  play(
                    Math.min(selection[0], selection[1]),
                    Math.max(selection[0], selection[1])
                  );
                }
              }}
              className="flex items-center rounded border border-blue-400 bg-blue-50 px-2 py-0.5 text-blue-800 hover:bg-blue-100 active:bg-blue-200 shadow-xs"
            >
              <span className="text-blue-500 mr-1.5">▶</span>
              <span className="font-semibold">{selectionDuration.toFixed(4)}</span>
              <span className="text-[9px] text-blue-500 ml-1">({t.editor.selection})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isPlaying) stop();
              else play(0, duration);
            }}
            className="flex items-center rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-50 active:bg-slate-200 shadow-xs"
          >
            <span className="text-slate-400 mr-1.5">▶</span>
            <span className="font-semibold">{duration.toFixed(4)}</span>
            <span className="text-[9px] text-slate-400 ml-1">({t.editor.total})</span>
          </button>
        </div>

        {/* Zoom buttons */}
        <div className="flex items-center space-x-1 font-semibold text-[11px]">
          <button
            type="button"
            onClick={zoomAll}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-50 active:bg-slate-200 shadow-xs"
          >
            {t.editor.zoomAll}
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-50 active:bg-slate-200 shadow-xs"
          >
            {t.editor.zoomIn}
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 hover:bg-slate-50 active:bg-slate-200 shadow-xs"
          >
            {t.editor.zoomOut}
          </button>
          <button
            type="button"
            disabled={!selection || selectionDuration <= 0.0005}
            onClick={zoomSel}
            className={`rounded border px-2 py-0.5 shadow-xs ${
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
            className={`rounded border px-2 py-0.5 shadow-xs ${
              zoomHistory.length > 0
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {t.editor.zoomBak}
          </button>

          <div className="h-4 border-l border-slate-300 mx-0.5" />

          {/* Undo button */}
          <button
            type="button"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            title="Undo (Ctrl+Z / ⌘Z)"
            className={`rounded border px-2 py-0.5 shadow-xs ${
              undoStack.length > 0
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {t.editor.undo}
          </button>

          {/* Redo button */}
          <button
            type="button"
            disabled={redoStack.length === 0}
            onClick={handleRedo}
            title="Redo (Ctrl+Y / ⌘⇧Z)"
            className={`rounded border px-2 py-0.5 shadow-xs ${
              redoStack.length > 0
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {t.editor.redo}
          </button>
        </div>
      </div>
    </div>
  );
};
