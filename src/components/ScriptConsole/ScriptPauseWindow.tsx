import React, { useState, useRef } from 'react';
import type { ScriptPauseData } from '../../types/wasm';

interface ScriptPauseWindowProps {
  pauseData: ScriptPauseData;
  onResume: (clickedButtonNumber: number) => void;
  onAbort: () => void;
}

export const ScriptPauseWindow: React.FC<ScriptPauseWindowProps> = ({
  pauseData,
  onResume,
  onAbort,
}) => {
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 32, y: 70 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.mouseX;
      const dy = moveEvent.clientY - dragStartRef.current.mouseY;
      setPosition({
        x: Math.max(10, dragStartRef.current.startX + dx),
        y: Math.max(10, dragStartRef.current.startY + dy),
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const defaultBtnIndex = pauseData.defaultButton > 0 ? pauseData.defaultButton - 1 : pauseData.buttons.length - 1;

  return (
    <div
      style={{ right: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-50 flex w-96 flex-col rounded-lg border-2 border-blue-400 bg-white/95 shadow-2xl backdrop-blur-xs select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Title Bar (Draggable) */}
      <div
        onMouseDown={handleMouseDown}
        className="flex cursor-move items-center justify-between border-b border-slate-200 bg-linear-to-r from-blue-600 to-indigo-600 px-3 py-2 text-white rounded-t-md"
      >
        <div className="flex items-center space-x-1.5 font-semibold text-xs tracking-wide">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-300 animate-pulse" />
          <span>{pauseData.title || 'Script paused'}</span>
        </div>
        <button
          type="button"
          onClick={onAbort}
          title="Abort script"
          className="rounded p-0.5 text-blue-100 hover:bg-white/20 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Comments / Info */}
      <div className="max-h-60 overflow-y-auto px-4 py-3 text-xs text-slate-700 space-y-1.5 select-text">
        {pauseData.comments && pauseData.comments.length > 0 ? (
          pauseData.comments.map((line, idx) => (
            <p key={idx} className={line === '' ? 'h-2' : 'leading-relaxed'}>
              {line}
            </p>
          ))
        ) : (
          <p className="italic text-slate-500">Script paused for user interaction.</p>
        )}
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end space-x-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5 rounded-b-md">
        {pauseData.buttons.map((btnName, idx) => {
          const isDefault = idx === defaultBtnIndex;
          const buttonNumber = idx + 1; // 1-indexed Praat button
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onResume(buttonNumber)}
              className={`rounded px-4 py-1.5 text-xs font-semibold shadow-xs transition-colors ${
                isDefault
                  ? 'bg-blue-600 text-white hover:bg-blue-700 ring-2 ring-blue-300'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {btnName}
            </button>
          );
        })}
      </div>
    </div>
  );
};
