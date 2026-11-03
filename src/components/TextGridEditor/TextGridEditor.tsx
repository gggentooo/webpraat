import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { infoOutputAtom, statusMessageAtom, mountedDirectoryAtom, activeEditorSaveCallbackAtom } from '../../store';
import { useI18n } from '../../hooks/useI18n';
import { useAudio } from '../../hooks/useAudio';
import { getPraatWorker, downloadBlob } from '../../utils/audio';
import { writeBackFile } from '../../utils/vfs';
import {
  serializeTextGrid,
  insertBoundaryInTier,
  moveBoundaryInTier,
  removeBoundaryFromTier,
  setIntervalTextInTier,
  insertIntervalOnTier,
  removeIntervalFromTier,
  addIntervalTierToGrid,
  addPointTierToGrid,
  removeTierFromGrid,
  duplicateTierInGrid,
  renameTierInGrid,
} from '../../utils/textgrid';
import { WaveformCanvas } from '../SoundEditor/WaveformCanvas';
import {
  TextGridTiersCanvas,
  TEXTGRID_TIER_LABEL_WIDTH_PX,
} from './TextGridTiersCanvas';
import { IPAPalette } from './IPAPalette';
import { TextGridMenuBar } from './TextGridMenuBar';
import { TextGridModals, type TextGridModalType } from './TextGridModals';
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
  const setInfoOutput = useSetAtom(infoOutputAtom);
  const setStatusMessage = useSetAtom(statusMessageAtom);
  const mountedDir = useAtomValue(mountedDirectoryAtom);
  const setActiveEditorSaveCallback = useSetAtom(activeEditorSaveCallbackAtom);

  // Audio samples & metadata
  const [channels, setChannels] = useState<Float64Array[]>([]);
  const [loading, setLoading] = useState(true);

  // TextGrid in-memory state
  const [gridData, setGridData] = useState<TextGridData | null>(null);
  const [selectedTierIndex, setSelectedTierIndex] = useState<number>(0);
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState<number | null>(null);

  // Active modal dialog state
  const [activeModal, setActiveModal] = useState<TextGridModalType>(null);

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
  const handleSelectInterval = useCallback((tierIndex: number, intervalIndex: number) => {
    commitPendingTextEdit();
    setSelectedTierIndex(tierIndex);
    setSelectedIntervalIndex(intervalIndex);

    if (gridDataRef.current && gridDataRef.current.tiers[tierIndex]?.type === 'IntervalTier') {
      const tier = gridDataRef.current.tiers[tierIndex] as IntervalTier;
      const interval = tier.intervals[intervalIndex];
      if (interval) {
        setActiveText(interval.text);
        setSelection([interval.xmin, interval.xmax]);
      }
    }
  }, [commitPendingTextEdit]);

  const handleAddBoundary = useCallback(async (tierIndex: number, time: number) => {
    if (!gridDataRef.current) return;
    const tier = gridDataRef.current.tiers[tierIndex];
    if (!tier || tier.type !== 'IntervalTier') return;

    commitPendingTextEdit();
    const stateBefore = captureCurrentState();
    if (stateBefore) pushUndoState(stateBefore);

    const updatedTier = insertBoundaryInTier(tier as IntervalTier, time);
    const updatedTiers = [...gridDataRef.current.tiers];
    updatedTiers[tierIndex] = updatedTier;
    const newGrid = { ...gridDataRef.current, tiers: updatedTiers };
    setGridData(newGrid);

    syncGridToWorker(newGrid);
  }, [commitPendingTextEdit, captureCurrentState, pushUndoState, syncGridToWorker]);

  const handleMoveBoundary = async (
    tierIndex: number,
    intervalIndex: number,
    newTime: number
  ) => {
    if (!gridDataRef.current) return;
    const tier = gridDataRef.current.tiers[tierIndex];
    if (!tier || tier.type !== 'IntervalTier') return;

    const updatedTier = moveBoundaryInTier(tier as IntervalTier, intervalIndex, newTime);
    const updatedTiers = [...gridDataRef.current.tiers];
    updatedTiers[tierIndex] = updatedTier;
    setGridData({ ...gridDataRef.current, tiers: updatedTiers });
  };

  const handleRemoveBoundary = useCallback(async (tierIndex: number, intervalIndex: number) => {
    if (!gridDataRef.current) return;
    const tier = gridDataRef.current.tiers[tierIndex];
    if (!tier || tier.type !== 'IntervalTier') return;

    commitPendingTextEdit();
    const stateBefore = captureCurrentState();
    if (stateBefore) pushUndoState(stateBefore);

    const updatedTier = removeBoundaryFromTier(tier as IntervalTier, intervalIndex);
    const updatedTiers = [...gridDataRef.current.tiers];
    updatedTiers[tierIndex] = updatedTier;
    const newGrid = { ...gridDataRef.current, tiers: updatedTiers };
    setGridData(newGrid);

    syncGridToWorker(newGrid);
  }, [commitPendingTextEdit, captureCurrentState, pushUndoState, syncGridToWorker]);

  const handleSetIntervalText = useCallback(async (
    tierIndex: number,
    intervalIndex: number,
    text: string
  ) => {
    if (!gridDataRef.current) return;
    const tier = gridDataRef.current.tiers[tierIndex];
    if (!tier || tier.type !== 'IntervalTier') return;

    if (!textEditOriginStateRef.current) {
      textEditOriginStateRef.current = captureCurrentState();
    }

    const updatedTier = setIntervalTextInTier(tier as IntervalTier, intervalIndex, text);
    const updatedTiers = [...gridDataRef.current.tiers];
    updatedTiers[tierIndex] = updatedTier;
    const newGrid = { ...gridDataRef.current, tiers: updatedTiers };
    setGridData(newGrid);
    setActiveText(text);

    if (textEditTimerRef.current) clearTimeout(textEditTimerRef.current);
    textEditTimerRef.current = setTimeout(() => {
      commitPendingTextEdit();
    }, 600);
  }, [captureCurrentState, commitPendingTextEdit]);

  const handleAddPoint = useCallback(async (tierIndex: number, time: number) => {
    if (!gridDataRef.current) return;
    const tier = gridDataRef.current.tiers[tierIndex];
    if (!tier || tier.type !== 'TextTier') return;

    commitPendingTextEdit();
    const stateBefore = captureCurrentState();
    if (stateBefore) pushUndoState(stateBefore);

    const newPoints = [...(tier as PointTier).points, { time, mark: '' }].sort(
      (a, b) => a.time - b.time
    );
    const updatedTiers = [...gridDataRef.current.tiers];
    updatedTiers[tierIndex] = { ...tier, points: newPoints };
    const newGrid = { ...gridDataRef.current, tiers: updatedTiers };
    setGridData(newGrid);

    syncGridToWorker(newGrid);
  }, [commitPendingTextEdit, captureCurrentState, pushUndoState, syncGridToWorker]);

  const handleMovePoint = async (
    tierIndex: number,
    pointIndex: number,
    newTime: number
  ) => {
    if (!gridDataRef.current) return;
    const tier = gridDataRef.current.tiers[tierIndex];
    if (!tier || tier.type !== 'TextTier') return;

    const newPoints = [...(tier as PointTier).points];
    newPoints[pointIndex] = { ...newPoints[pointIndex], time: newTime };
    const updatedTiers = [...gridDataRef.current.tiers];
    updatedTiers[tierIndex] = { ...tier, points: newPoints };
    setGridData({ ...gridDataRef.current, tiers: updatedTiers });
  };

  const handleSetPointText = async (
    tierIndex: number,
    pointIndex: number,
    text: string
  ) => {
    if (!gridDataRef.current) return;
    const tier = gridDataRef.current.tiers[tierIndex];
    if (!tier || tier.type !== 'TextTier') return;

    commitPendingTextEdit();
    const stateBefore = captureCurrentState();
    if (stateBefore) pushUndoState(stateBefore);

    const newPoints = [...(tier as PointTier).points];
    newPoints[pointIndex] = { ...newPoints[pointIndex], mark: text };
    const updatedTiers = [...gridDataRef.current.tiers];
    updatedTiers[tierIndex] = { ...tier, points: newPoints };
    const newGrid = { ...gridDataRef.current, tiers: updatedTiers };
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

  // Export TextGrid as downloadable file or save to mounted VFS & local folder
  const handleExportTextGrid = useCallback(async (): Promise<boolean> => {
    commitPendingTextEdit();
    if (!gridDataRef.current) return false;
    const serialized = serializeTextGrid(gridDataRef.current);
    const worker = getPraatWorker();

    try {
      await worker.updateTextGridData(textGrid.id, gridDataRef.current);
    } catch (err) {
      console.warn('Failed to sync TextGrid to WASM object:', err);
    }

    if (mountedDir) {
      try {
        const fileName = `${textGrid.name}.TextGrid`;
        await writeBackFile(worker, mountedDir, `textgrids/${fileName}`, serialized);
        await writeBackFile(worker, mountedDir, fileName, serialized);
        setStatusMessage(`${t.status.textGridSaved}: ${fileName}`);
        return true;
      } catch (err) {
        console.error('Failed to write back to mounted folder:', err);
        return false;
      }
    }

    const blob = new Blob([serialized], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${textGrid.name}.TextGrid`);
    setStatusMessage(`${t.status.textGridSaved}: ${textGrid.name}.TextGrid`);
    return true;
  }, [commitPendingTextEdit, textGrid.name, textGrid.id, mountedDir, setStatusMessage, t]);

  // Phase 10: Register auto-save callback for interactive script stepping ([Next] button)
  useEffect(() => {
    setActiveEditorSaveCallback(() => handleExportTextGrid());
    return () => {
      setActiveEditorSaveCallback(null);
    };
  }, [setActiveEditorSaveCallback, handleExportTextGrid]);

  // Get current cursor time (from selection start, playhead, or viewport center)
  const getCursorTime = useCallback((): number => {
    if (selectionRef.current) {
      return Math.min(selectionRef.current[0], selectionRef.current[1]);
    }
    if (playheadTime !== null && playheadTime !== undefined) {
      return playheadTime;
    }
    return (tmin + tmax) / 2;
  }, [playheadTime, tmin, tmax]);

  // Phase 8: Interval Operations
  const handleNewIntervalOnTier = useCallback(
    (tierIndex: number, text: string) => {
      if (!gridDataRef.current) return;
      const currentGrid = gridDataRef.current;
      const tier = currentGrid.tiers[tierIndex];
      if (!tier || tier.type !== 'IntervalTier') return;

      commitPendingTextEdit();
      const stateBefore = captureCurrentState();
      if (stateBefore) pushUndoState(stateBefore);

      let start = tmin;
      let end = tmax;
      if (
        selectionRef.current &&
        Math.abs(selectionRef.current[1] - selectionRef.current[0]) > 0.0005
      ) {
        start = Math.min(selectionRef.current[0], selectionRef.current[1]);
        end = Math.max(selectionRef.current[0], selectionRef.current[1]);
      } else {
        const cTime = getCursorTime();
        start = Math.max(tier.xmin, cTime - 0.1);
        end = Math.min(tier.xmax, cTime + 0.1);
      }

      const { updatedTier, newIntervalIndex } = insertIntervalOnTier(
        tier as IntervalTier,
        start,
        end,
        text
      );
      const updatedTiers = [...currentGrid.tiers];
      updatedTiers[tierIndex] = updatedTier;
      const newGrid = { ...currentGrid, tiers: updatedTiers };
      setGridData(newGrid);
      syncGridToWorker(newGrid);

      // Select newly created interval
      if (newIntervalIndex !== -1) {
        setSelectedTierIndex(tierIndex);
        setSelectedIntervalIndex(newIntervalIndex);
        setActiveText(text);
      }
    },
    [commitPendingTextEdit, captureCurrentState, pushUndoState, tmin, tmax, getCursorTime, syncGridToWorker]
  );

  const handleRemoveSelectedInterval = useCallback(() => {
    if (!gridDataRef.current || selectedIntervalIndexRef.current === null) return;
    const currentGrid = gridDataRef.current;
    const tierIndex = selectedTierIndexRef.current;
    const tier = currentGrid.tiers[tierIndex];
    if (!tier || tier.type !== 'IntervalTier') return;

    commitPendingTextEdit();
    const stateBefore = captureCurrentState();
    if (stateBefore) pushUndoState(stateBefore);

    const updatedTier = removeIntervalFromTier(
      tier as IntervalTier,
      selectedIntervalIndexRef.current
    );
    const updatedTiers = [...currentGrid.tiers];
    updatedTiers[tierIndex] = updatedTier;
    const newGrid = { ...currentGrid, tiers: updatedTiers };
    setGridData(newGrid);
    syncGridToWorker(newGrid);

    const nextIdx = Math.min(
      selectedIntervalIndexRef.current,
      updatedTier.intervals.length - 1
    );
    setSelectedIntervalIndex(nextIdx >= 0 ? nextIdx : null);
    if (nextIdx >= 0) {
      setActiveText(updatedTier.intervals[nextIdx].text);
      setSelection([updatedTier.intervals[nextIdx].xmin, updatedTier.intervals[nextIdx].xmax]);
    } else {
      setActiveText('');
    }
  }, [commitPendingTextEdit, captureCurrentState, pushUndoState, syncGridToWorker]);

  const handleClearIntervalText = useCallback(() => {
    if (selectedIntervalIndex !== null) {
      handleSetIntervalText(selectedTierIndex, selectedIntervalIndex, '');
    }
  }, [selectedIntervalIndex, selectedTierIndex, handleSetIntervalText]);

  // Phase 8: Boundary Operations & Multi-tier Insertion
  const handleAddBoundaryAllTiers = useCallback(
    (customTime?: number) => {
      if (!gridDataRef.current) return;
      const currentGrid = gridDataRef.current;
      const time = customTime !== undefined ? customTime : getCursorTime();

      commitPendingTextEdit();
      const stateBefore = captureCurrentState();
      if (stateBefore) pushUndoState(stateBefore);

      const updatedTiers = currentGrid.tiers.map((tier) => {
        if (tier.type === 'IntervalTier') {
          return insertBoundaryInTier(tier as IntervalTier, time);
        } else {
          const points = [...(tier as PointTier).points, { time, mark: '' }].sort(
            (a, b) => a.time - b.time
          );
          return { ...tier, points };
        }
      });

      const newGrid = { ...currentGrid, tiers: updatedTiers };
      setGridData(newGrid);
      syncGridToWorker(newGrid);
    },
    [commitPendingTextEdit, captureCurrentState, getCursorTime, pushUndoState, syncGridToWorker]
  );

  const handleAddBoundaryAtCursor = useCallback(() => {
    if (!gridDataRef.current) return;
    const time = getCursorTime();
    const tierIndex = selectedTierIndexRef.current;
    const tier = gridDataRef.current.tiers[tierIndex];
    if (!tier) return;
    if (tier.type === 'IntervalTier') {
      handleAddBoundary(tierIndex, time);
    } else {
      handleAddPoint(tierIndex, time);
    }
  }, [getCursorTime, handleAddBoundary, handleAddPoint]);

  const handleRemoveBoundaryAtCursor = useCallback(() => {
    if (!gridDataRef.current) return;
    const currentGrid = gridDataRef.current;
    const tierIndex = selectedTierIndexRef.current;
    const tier = currentGrid.tiers[tierIndex];
    if (!tier || tier.type !== 'IntervalTier') return;

    const time = getCursorTime();
    let closestIdx = -1;
    let minDiff = 0.05; // 50ms tolerance
    for (let i = 0; i < tier.intervals.length - 1; i++) {
      const diff = Math.abs(tier.intervals[i].xmax - time);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i + 1;
      }
    }

    if (closestIdx !== -1) {
      handleRemoveBoundary(tierIndex, closestIdx);
    }
  }, [getCursorTime, handleRemoveBoundary]);

  const handleMoveBoundaryToCursor = useCallback(() => {
    if (!gridDataRef.current) return;
    const currentGrid = gridDataRef.current;
    const tierIndex = selectedTierIndexRef.current;
    const tier = currentGrid.tiers[tierIndex];
    if (!tier || tier.type !== 'IntervalTier') return;

    const time = getCursorTime();
    let closestIdx = -1;
    let minDiff = Infinity;
    for (let i = 1; i < tier.intervals.length; i++) {
      const diff = Math.abs(tier.intervals[i].xmin - time);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    if (closestIdx !== -1) {
      commitPendingTextEdit();
      const stateBefore = captureCurrentState();
      if (stateBefore) pushUndoState(stateBefore);

      const updatedTier = moveBoundaryInTier(tier as IntervalTier, closestIdx, time);
      const updatedTiers = [...currentGrid.tiers];
      updatedTiers[tierIndex] = updatedTier;
      const newGrid = { ...currentGrid, tiers: updatedTiers };
      setGridData(newGrid);
      syncGridToWorker(newGrid);
    }
  }, [getCursorTime, commitPendingTextEdit, captureCurrentState, pushUndoState, syncGridToWorker]);

  // Phase 8: Tier Management Handlers
  const handleAddTier = useCallback(
    async (isInterval: boolean, name: string, position: number) => {
      if (!gridDataRef.current) return;
      commitPendingTextEdit();
      const stateBefore = captureCurrentState();
      if (stateBefore) pushUndoState(stateBefore);

      const currentGrid = gridDataRef.current;
      const newGrid = isInterval
        ? addIntervalTierToGrid(currentGrid, position, name)
        : addPointTierToGrid(currentGrid, position, name);

      setGridData(newGrid);
      setSelectedTierIndex(Math.max(0, position - 1));
      setSelectedIntervalIndex(null);

      try {
        const worker = getPraatWorker();
        await worker.textgridAddTier(textGrid.id, position, name, isInterval);
        syncGridToWorker(newGrid);
      } catch (err) {
        console.warn('Worker tier addition failed:', err);
      }
    },
    [commitPendingTextEdit, captureCurrentState, pushUndoState, textGrid.id, syncGridToWorker]
  );

  const handleDuplicateTier = useCallback(
    async (sourceIndex: number, targetPosition: number, newName: string) => {
      if (!gridDataRef.current) return;
      commitPendingTextEdit();
      const stateBefore = captureCurrentState();
      if (stateBefore) pushUndoState(stateBefore);

      const currentGrid = gridDataRef.current;
      const newGrid = duplicateTierInGrid(currentGrid, sourceIndex, targetPosition, newName);

      setGridData(newGrid);
      setSelectedTierIndex(Math.max(0, targetPosition - 1));

      try {
        const worker = getPraatWorker();
        await worker.textgridDuplicateTier(textGrid.id, sourceIndex + 1, targetPosition, newName);
        syncGridToWorker(newGrid);
      } catch (err) {
        console.warn('Worker tier duplication failed:', err);
      }
    },
    [commitPendingTextEdit, captureCurrentState, pushUndoState, textGrid.id, syncGridToWorker]
  );

  const handleRenameTier = useCallback(
    async (tierIndex: number, newName: string) => {
      if (!gridDataRef.current) return;
      commitPendingTextEdit();
      const stateBefore = captureCurrentState();
      if (stateBefore) pushUndoState(stateBefore);

      const currentGrid = gridDataRef.current;
      const newGrid = renameTierInGrid(currentGrid, tierIndex, newName);

      setGridData(newGrid);

      try {
        const worker = getPraatWorker();
        await worker.textgridRenameTier(textGrid.id, tierIndex + 1, newName);
        syncGridToWorker(newGrid);
      } catch (err) {
        console.warn('Worker tier renaming failed:', err);
      }
    },
    [commitPendingTextEdit, captureCurrentState, pushUndoState, textGrid.id, syncGridToWorker]
  );

  const handleRemoveTier = useCallback(
    async (tierIndex: number) => {
      if (!gridDataRef.current || gridDataRef.current.tiers.length <= 1) return;
      commitPendingTextEdit();
      const stateBefore = captureCurrentState();
      if (stateBefore) pushUndoState(stateBefore);

      const currentGrid = gridDataRef.current;
      const newGrid = removeTierFromGrid(currentGrid, tierIndex);

      setGridData(newGrid);
      const newSelectedIdx = Math.max(0, Math.min(newGrid.tiers.length - 1, tierIndex));
      setSelectedTierIndex(newSelectedIdx);
      setSelectedIntervalIndex(null);

      try {
        const worker = getPraatWorker();
        await worker.textgridRemoveTier(textGrid.id, tierIndex + 1);
        syncGridToWorker(newGrid);
      } catch (err) {
        console.warn('Worker tier removal failed:', err);
      }
    },
    [commitPendingTextEdit, captureCurrentState, pushUndoState, textGrid.id, syncGridToWorker]
  );

  // Phase 8: Query & Navigation Handlers
  const handleQuery = useCallback(
    (queryType: string) => {
      if (!gridDataRef.current) return;
      const currentGrid = gridDataRef.current;
      let msg = '';
      const cursor = getCursorTime();

      if (queryType === 'cursorTime') {
        msg = t.textGridMenu.cursorPlacedAt.replace('{time}', cursor.toFixed(6));
      } else if (queryType === 'selectionStart') {
        const s0 = selectionRef.current ? Math.min(selectionRef.current[0], selectionRef.current[1]) : cursor;
        msg = `Selection start = ${s0.toFixed(6)} s`;
      } else if (queryType === 'selectionEnd') {
        const s1 = selectionRef.current ? Math.max(selectionRef.current[0], selectionRef.current[1]) : cursor;
        msg = `Selection end = ${s1.toFixed(6)} s`;
      } else if (queryType === 'selectionLength') {
        const dur = selectionRef.current ? Math.abs(selectionRef.current[1] - selectionRef.current[0]) : 0;
        msg = `Selection length = ${dur.toFixed(6)} s`;
      } else if (queryType === 'intervalLabel') {
        const tier = currentGrid.tiers[selectedTierIndexRef.current];
        if (tier && tier.type === 'IntervalTier' && selectedIntervalIndexRef.current !== null) {
          const text = tier.intervals[selectedIntervalIndexRef.current]?.text || '';
          msg = t.textGridMenu.intervalLabelIs.replace('{text}', text);
        } else {
          msg = t.textGridMenu.noIntervalSelected;
        }
      } else if (queryType === 'numberOfTiers') {
        msg = t.textGridMenu.tierCountIs.replace('{count}', String(currentGrid.tiers.length));
      } else if (queryType === 'numberOfIntervals') {
        const tier = currentGrid.tiers[selectedTierIndexRef.current];
        if (tier && tier.type === 'IntervalTier') {
          msg = t.textGridMenu.intervalsOnTierCountIs
            .replace('{tier}', String(selectedTierIndexRef.current + 1))
            .replace('{count}', String(tier.intervals.length));
        } else {
          msg = `Tier ${selectedTierIndexRef.current + 1} is not an interval tier`;
        }
      }

      if (msg) {
        setInfoOutput((prev) => (prev ? `${prev}\n${msg}` : msg));
        setStatusMessage(msg);
        setTimeout(() => setStatusMessage(''), 4000);
      }
    },
    [getCursorTime, t, setInfoOutput, setStatusMessage]
  );

  const handleSelectAction = useCallback(
    (actionType: 'start' | 'end' | 'prev' | 'next') => {
      if (!gridDataRef.current) return;
      const currentGrid = gridDataRef.current;
      const tier = currentGrid.tiers[selectedTierIndexRef.current];

      if (actionType === 'start') {
        if (selectionRef.current) {
          const s0 = Math.min(selectionRef.current[0], selectionRef.current[1]);
          setSelection([s0, s0]);
          seek(s0);
        }
      } else if (actionType === 'end') {
        if (selectionRef.current) {
          const s1 = Math.max(selectionRef.current[0], selectionRef.current[1]);
          setSelection([s1, s1]);
          seek(s1);
        }
      } else if (tier && tier.type === 'IntervalTier') {
        const currentIdx = selectedIntervalIndexRef.current ?? 0;
        if (actionType === 'prev') {
          const prevIdx = Math.max(0, currentIdx - 1);
          handleSelectInterval(selectedTierIndexRef.current, prevIdx);
        } else if (actionType === 'next') {
          const nextIdx = Math.min(tier.intervals.length - 1, currentIdx + 1);
          handleSelectInterval(selectedTierIndexRef.current, nextIdx);
        }
      }
    },
    [seek, handleSelectInterval]
  );

  // Keyboard navigation & Shortcuts (Phase 8)
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

      // Enter -> Add boundary at cursor on tier
      // Cmd/Ctrl + Enter -> Add boundary on all tiers
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          handleAddBoundaryAllTiers();
        } else {
          handleAddBoundaryAtCursor();
        }
        return;
      }

      // Alt + Backspace / Delete -> Remove boundary at cursor
      if (e.altKey && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        handleRemoveBoundaryAtCursor();
        return;
      }

      // Cmd/Ctrl + I -> New interval on tier dialog
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setActiveModal('newInterval');
        return;
      }

      // Cmd/Ctrl + S -> Export TextGrid
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleExportTextGrid();
        return;
      }

      // Alt + Left / Right -> Select previous / next interval
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        handleSelectAction(e.key === 'ArrowLeft' ? 'prev' : 'next');
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
  }, [
    handleUndo,
    handleRedo,
    handleAddBoundaryAllTiers,
    handleAddBoundaryAtCursor,
    handleRemoveBoundaryAtCursor,
    handleExportTextGrid,
    handleSelectAction,
    isPlaying,
    play,
    stop,
    selection,
    tmin,
    tmax,
  ]);

  const visibleDuration = Math.max(0, tmax - tmin);
  const selectionDuration = selection
    ? Math.max(0, Math.abs(selection[1] - selection[0]))
    : 0;

  return (
    <div className="flex h-full w-full flex-col bg-white text-slate-800 text-xs select-none">
      {/* 1. Top Window Title Bar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-slate-300 bg-slate-100 px-3">
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

        <div className="flex items-center space-x-2 shrink-0">
          {/* Export TextGrid Button */}
          <button
            type="button"
            onClick={handleExportTextGrid}
            className="rounded border border-blue-600 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 active:bg-blue-200 shadow-xs whitespace-nowrap shrink-0"
          >
            Export .TextGrid
          </button>

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

      {/* 2. Dedicated TextGrid Editor Menu Bar (Phase 8) */}
      <TextGridMenuBar
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={handleExportTextGrid}
        onClose={onClose}
        onOpenNewIntervalModal={() => setActiveModal('newInterval')}
        onRemoveInterval={handleRemoveSelectedInterval}
        onOpenSetIntervalTextModal={() => setActiveModal('setIntervalText')}
        onClearIntervalText={handleClearIntervalText}
        onAddBoundaryAtCursor={handleAddBoundaryAtCursor}
        onAddBoundaryOnAllTiers={() => handleAddBoundaryAllTiers()}
        onRemoveBoundaryAtCursor={handleRemoveBoundaryAtCursor}
        onMoveBoundaryToCursor={handleMoveBoundaryToCursor}
        onOpenAddIntervalTierModal={() => setActiveModal('addIntervalTier')}
        onOpenAddPointTierModal={() => setActiveModal('addPointTier')}
        onOpenDuplicateTierModal={() => setActiveModal('duplicateTier')}
        onOpenRenameTierModal={() => setActiveModal('renameTier')}
        onOpenRemoveTierModal={() => setActiveModal('removeTier')}
        onQuery={handleQuery}
        onSelectAction={handleSelectAction}
      />

      {/* 3. Top Active Interval Text & IPA Palette */}
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

      {/* 4. Canvases Body (Waveform top, TextGrid tiers directly beneath) */}
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
                  playheadTime={playheadTime}
                  onSelectInterval={handleSelectInterval}
                  onAddBoundary={handleAddBoundary}
                  onAddBoundaryAllTiers={handleAddBoundaryAllTiers}
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

      {/* 5. Bottom Time Ruler */}
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

      {/* 6. Praat Playback & Zoom Bar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-slate-300 bg-slate-200 px-2 overflow-x-auto overflow-y-hidden">
        {/* Playback buttons */}
        <div className="flex items-center space-x-1.5 font-mono text-[11px] shrink-0">
          <button
            type="button"
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
              className="flex items-center rounded border border-blue-400 bg-blue-50 px-2 py-0.5 text-blue-800 hover:bg-blue-100 active:bg-blue-200 shadow-xs whitespace-nowrap shrink-0"
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
            className="flex items-center rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-50 active:bg-slate-200 shadow-xs whitespace-nowrap shrink-0"
          >
            <span className="text-slate-400 mr-1.5">▶</span>
            <span className="font-semibold">{duration.toFixed(4)}</span>
            <span className="text-[9px] text-slate-400 ml-1">({t.editor.total})</span>
          </button>
        </div>

        {/* Zoom buttons */}
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
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            title="Undo (Ctrl+Z / ⌘Z)"
            className={`rounded border px-2 py-0.5 shadow-xs whitespace-nowrap shrink-0 ${
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
            className={`rounded border px-2 py-0.5 shadow-xs whitespace-nowrap shrink-0 ${
              redoStack.length > 0
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-200'
                : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {t.editor.redo}
          </button>
        </div>
      </div>

      {/* 7. Phase 8 Modal Dialogs */}
      <TextGridModals
        modalType={activeModal}
        gridData={gridData}
        selectedTierIndex={selectedTierIndex}
        selectedIntervalIndex={selectedIntervalIndex}
        selection={selection}
        onClose={() => setActiveModal(null)}
        onConfirmNewInterval={handleNewIntervalOnTier}
        onConfirmAddTier={handleAddTier}
        onConfirmDuplicateTier={handleDuplicateTier}
        onConfirmRenameTier={handleRenameTier}
        onConfirmRemoveTier={handleRemoveTier}
        onConfirmSetIntervalText={(tIdx, iIdx, text) =>
          handleSetIntervalText(tIdx, iIdx, text)
        }
      />
    </div>
  );
};
