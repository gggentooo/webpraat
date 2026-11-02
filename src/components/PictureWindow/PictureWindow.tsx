import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  activeTabAtom,
  pictureCommandsAtom,
  picturePenAtom,
  pictureViewportAtom,
  statusMessageAtom,
  tAtom,
} from '../../store';
import type { PictureCommand, PictureLineType, PraatColour } from '../../types/praat';
import { downloadBlob } from '../../utils/audio';
import {
  PAGE_INCHES,
  PRAAT_COLOURS_LIST,
  PRAAT_COLOUR_HEX,
  exportPictureToPngBlob,
  renderPictureToCanvas,
  renderPictureToSvg,
} from '../../utils/pictureRenderer';

const CANVAS_LOGICAL_PX = 648; // 54 px per inch

export const PictureWindow: React.FC = () => {
  const [commands, setCommands] = useAtom(pictureCommandsAtom);
  const [redoCommands, setRedoCommands] = useState<PictureCommand[]>([]);
  const [viewport, setViewport] = useAtom(pictureViewportAtom);
  const [pen, setPen] = useAtom(picturePenAtom);
  const setActiveTab = useSetAtom(activeTabAtom);
  const setStatusMessage = useSetAtom(statusMessageAtom);
  const t = useAtomValue(tAtom);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dragStartInch, setDragStartInch] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(CANVAS_LOGICAL_PX * dpr);
    canvas.height = Math.round(CANVAS_LOGICAL_PX * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderPictureToCanvas(
      ctx,
      CANVAS_LOGICAL_PX,
      CANVAS_LOGICAL_PX,
      commands,
      viewport,
      true
    );
  }, [commands, viewport]);

  const clientToInch = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * PAGE_INCHES;
    const rawY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * PAGE_INCHES;
    const snap = (v: number) => Math.max(0, Math.min(PAGE_INCHES, Math.round(v * 4) / 4));
    return { x: snap(rawX), y: snap(rawY) };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const pt = clientToInch(e);
    setDragStartInch(pt);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStartInch) return;
    const pt = clientToInch(e);
    const x1 = Math.min(dragStartInch.x, pt.x);
    const x2 = Math.max(dragStartInch.x, pt.x);
    const y1 = Math.min(dragStartInch.y, pt.y);
    const y2 = Math.max(dragStartInch.y, pt.y);
    if (x2 - x1 >= 0.5 && y2 - y1 >= 0.5) {
      setViewport({ x1, x2, y1, y2 });
    }
  };

  const handleMouseUp = () => {
    setDragStartInch(null);
  };

  const handleDrawInnerBox = () => {
    setCommands((prev) => [
      ...prev,
      {
        id: `box_${Date.now()}`,
        kind: 'primitive',
        viewport: { ...viewport },
        pen: { ...pen },
        shape: 'innerBox',
      },
    ]);
    setRedoCommands([]);
    setStatusMessage(t.status.drawnToPicture);
  };

  const handleTextTop = () => {
    const label = window.prompt(t.picture.enterTitlePrompt, '');
    if (!label) return;
    setCommands((prev) => [
      ...prev,
      {
        id: `txt_${Date.now()}`,
        kind: 'primitive',
        viewport: { ...viewport },
        pen: { ...pen },
        shape: 'textTop',
        text: label,
      },
    ]);
    setRedoCommands([]);
    setStatusMessage(t.status.drawnToPicture);
  };

  const handleUndo = useCallback(() => {
    setCommands((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoCommands((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  }, [setCommands]);

  const handleRedo = useCallback(() => {
    setRedoCommands((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const next = prevRedo[prevRedo.length - 1];
      setCommands((prev) => [...prev, next]);
      return prevRedo.slice(0, -1);
    });
  }, [setCommands]);

  const handleEraseAll = () => {
    setCommands([]);
    setRedoCommands([]);
  };

  // Keyboard undo/redo shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isUndo =
        (e.metaKey || e.ctrlKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'z';

      const isRedo =
        ((e.metaKey || e.ctrlKey) && !e.altKey && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'y');

      if (isUndo) {
        e.preventDefault();
        handleUndo();
      } else if (isRedo) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleExportSvg = () => {
    const svg = renderPictureToSvg(commands);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, 'praat_picture.svg');
    setStatusMessage(`${t.status.pictureExported}: praat_picture.svg`);
  };

  const handleExportPng = async () => {
    try {
      const blob = await exportPictureToPngBlob(commands, 150);
      downloadBlob(blob, 'praat_picture.png');
      setStatusMessage(`${t.status.pictureExported}: praat_picture.png`);
    } catch (err) {
      console.error('PNG export failed:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-100 rounded border border-slate-300 shadow-sm overflow-hidden min-h-0">
      {/* Header Toolbar */}
      <div className="bg-white px-3 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{t.app.pictureTitle}</span>
          <span className="px-2 py-0.5 text-[11px] font-mono bg-slate-100 text-slate-600 rounded border border-slate-200">
            {commands.length} {t.picture.commandsCount}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleDrawInnerBox}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded transition-colors"
          >
            {t.picture.drawInnerBox}
          </button>
          <button
            type="button"
            onClick={handleTextTop}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded transition-colors"
          >
            {t.picture.textTop}
          </button>
          <button
            type="button"
            disabled={commands.length === 0}
            onClick={handleUndo}
            title="Undo (Ctrl+Z / ⌘Z)"
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded disabled:opacity-40 transition-colors"
          >
            {t.picture.undo}
          </button>
          <button
            type="button"
            disabled={redoCommands.length === 0}
            onClick={handleRedo}
            title="Redo (Ctrl+Y / ⌘⇧Z)"
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded disabled:opacity-40 transition-colors"
          >
            {t.picture.redo}
          </button>
          <button
            type="button"
            disabled={commands.length === 0}
            onClick={handleEraseAll}
            className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded disabled:opacity-40 transition-colors"
          >
            {t.picture.eraseAll}
          </button>

          <div className="h-4 w-px bg-slate-300 mx-0.5" />

          <button
            type="button"
            onClick={handleExportSvg}
            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors"
          >
            {t.picture.exportSvg}
          </button>
          <button
            type="button"
            onClick={() => void handleExportPng()}
            className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs transition-colors"
          >
            {t.picture.exportPng}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('objects')}
            className="ml-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
          >
            {t.picture.closeTab}
          </button>
        </div>
      </div>

      {/* Pen & Viewport Ribbon */}
      <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex flex-wrap items-center gap-3 text-xs shrink-0">
        {/* Colour */}
        <label className="flex items-center gap-1.5 text-slate-700">
          <span
            className="inline-block w-3 h-3 rounded-xs border border-slate-400"
            style={{ backgroundColor: PRAAT_COLOUR_HEX[pen.colour] }}
          />
          <span>{t.picture.colour}:</span>
          <select
            value={pen.colour}
            onChange={(e) => setPen({ ...pen, colour: e.target.value as PraatColour })}
            className="px-1.5 py-0.5 border border-slate-300 rounded bg-white text-xs"
          >
            {PRAAT_COLOURS_LIST.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </label>

        {/* Line Type */}
        <label className="flex items-center gap-1 text-slate-700">
          <span>{t.picture.lineType}:</span>
          <select
            value={pen.lineType}
            onChange={(e) => setPen({ ...pen, lineType: e.target.value as PictureLineType })}
            className="px-1.5 py-0.5 border border-slate-300 rounded bg-white text-xs"
          >
            <option value="solid">{t.picture.solid}</option>
            <option value="dotted">{t.picture.dotted}</option>
            <option value="dashed">{t.picture.dashed}</option>
            <option value="dash-dotted">{t.picture.dashDotted}</option>
          </select>
        </label>

        {/* Line Width */}
        <label className="flex items-center gap-1 text-slate-700">
          <span>{t.picture.lineWidth}:</span>
          <select
            value={pen.lineWidth}
            onChange={(e) => setPen({ ...pen, lineWidth: Number(e.target.value) })}
            className="px-1.5 py-0.5 border border-slate-300 rounded bg-white text-xs font-mono"
          >
            {[1, 1.5, 2, 3, 4, 5].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>

        {/* Font Size */}
        <label className="flex items-center gap-1 text-slate-700">
          <span>{t.picture.fontSize}:</span>
          <select
            value={pen.fontSize}
            onChange={(e) => setPen({ ...pen, fontSize: Number(e.target.value) })}
            className="px-1.5 py-0.5 border border-slate-300 rounded bg-white text-xs font-mono"
          >
            {[10, 12, 14, 18, 24].map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>
        </label>

        {/* Garnish */}
        <label className="flex items-center gap-1 text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={pen.garnish}
            onChange={(e) => setPen({ ...pen, garnish: e.target.checked })}
            className="rounded border-slate-300 text-blue-600"
          />
          <span>{t.picture.garnish}</span>
        </label>

        {/* Outer Viewport Numeric Controls */}
        <div className="ml-auto flex items-center gap-1 font-mono text-[11px] text-slate-600">
          <span className="font-sans text-slate-700">{t.picture.outerViewport}:</span>
          <span>x[</span>
          <input
            type="number"
            step="0.5"
            min="0"
            max="11.5"
            value={viewport.x1}
            onChange={(e) => setViewport({ ...viewport, x1: Number(e.target.value) })}
            className="w-12 px-1 py-0.5 border border-slate-300 rounded bg-white text-center"
          />
          <span>..</span>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="12"
            value={viewport.x2}
            onChange={(e) => setViewport({ ...viewport, x2: Number(e.target.value) })}
            className="w-12 px-1 py-0.5 border border-slate-300 rounded bg-white text-center"
          />
          <span>] y[</span>
          <input
            type="number"
            step="0.5"
            min="0"
            max="11.5"
            value={viewport.y1}
            onChange={(e) => setViewport({ ...viewport, y1: Number(e.target.value) })}
            className="w-12 px-1 py-0.5 border border-slate-300 rounded bg-white text-center"
          />
          <span>..</span>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="12"
            value={viewport.y2}
            onChange={(e) => setViewport({ ...viewport, y2: Number(e.target.value) })}
            className="w-12 px-1 py-0.5 border border-slate-300 rounded bg-white text-center"
          />
          <span>]</span>
        </div>
      </div>

      {/* Scrollable 12" × 12" Paper Canvas Area with Rulers */}
      <div className="flex-1 overflow-auto p-4 flex flex-col items-center">
        <p className="text-[11px] text-slate-500 mb-2 text-center">{t.picture.emptyHint}</p>

        <div className="inline-block bg-slate-200 p-2 rounded shadow-md border border-slate-300 select-none">
          {/* Top Horizontal Inch Ruler (0..12) */}
          <div
            className="flex justify-between text-[10px] font-mono text-slate-500 pl-5 pr-1 pb-1"
            style={{ width: CANVAS_LOGICAL_PX + 20 }}
          >
            {Array.from({ length: PAGE_INCHES + 1 }, (_, idx) => (
              <span key={idx}>{idx}&quot;</span>
            ))}
          </div>

          <div className="flex">
            {/* Left Vertical Inch Ruler (0..12) */}
            <div
              className="flex flex-col justify-between text-[10px] font-mono text-slate-500 pr-1.5 items-end"
              style={{ height: CANVAS_LOGICAL_PX }}
            >
              {Array.from({ length: PAGE_INCHES + 1 }, (_, idx) => (
                <span key={idx} className="leading-none">
                  {idx}
                </span>
              ))}
            </div>

            {/* Interactive 12" × 12" Paper Canvas */}
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ width: CANVAS_LOGICAL_PX, height: CANVAS_LOGICAL_PX }}
              className="bg-white border border-slate-400 cursor-crosshair block shadow-inner"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
