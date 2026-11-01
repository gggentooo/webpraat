import React, { useState, useRef, useEffect, useCallback } from 'react';
import type {
  TextGridData,
  IntervalTier,
  PointTier,
} from '../../types/praat';

export interface TextGridTiersCanvasProps {
  textGrid: TextGridData;
  tmin: number;
  tmax: number;
  selection: [number, number] | null;
  selectedTierIndex: number;
  selectedIntervalIndex: number | null;
  onSelectInterval: (tierIndex: number, intervalIndex: number) => void;
  onAddBoundary: (tierIndex: number, time: number) => void;
  onMoveBoundary: (tierIndex: number, intervalIndex: number, newTime: number) => void;
  onRemoveBoundary: (tierIndex: number, intervalIndex: number) => void;
  onSetIntervalText: (tierIndex: number, intervalIndex: number, text: string) => void;
  onAddPoint: (tierIndex: number, time: number) => void;
  onMovePoint: (tierIndex: number, pointIndex: number, newTime: number) => void;
  onSetPointText: (tierIndex: number, pointIndex: number, text: string) => void;
}

export const TextGridTiersCanvas: React.FC<TextGridTiersCanvasProps> = ({
  textGrid,
  tmin,
  tmax,
  selection,
  selectedTierIndex,
  selectedIntervalIndex,
  onSelectInterval,
  onAddBoundary,
  onMoveBoundary,
  onRemoveBoundary,
  onSetIntervalText,
  onAddPoint,
  onMovePoint,
  onSetPointText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Dragging state for moving interval boundary
  const [draggingBoundary, setDraggingBoundary] = useState<{
    tierIndex: number;
    intervalIndex: number;
  } | null>(null);

  // Dragging state for moving point in TextTier
  const [draggingPoint, setDraggingPoint] = useState<{
    tierIndex: number;
    pointIndex: number;
  } | null>(null);

  // Inline editing state for interval text
  const [editingTarget, setEditingTarget] = useState<{
    tierIndex: number;
    intervalIndex: number;
  } | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const timeSpan = Math.max(0.0001, tmax - tmin);

  // Auto-focus input when editing opens
  useEffect(() => {
    if (editingTarget && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTarget]);

  const getTimeFromX = useCallback(
    (clientX: number): number => {
      if (!containerRef.current) return tmin;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - (rect.left + 96), rect.width - 96));
      return tmin + (x / Math.max(1, rect.width - 96)) * timeSpan;
    },
    [tmin, timeSpan]
  );

  // Mouse drag listeners on window for smooth boundary and point movement
  useEffect(() => {
    if (!draggingBoundary && !draggingPoint) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newTime = getTimeFromX(e.clientX);
      if (draggingBoundary) {
        onMoveBoundary(draggingBoundary.tierIndex, draggingBoundary.intervalIndex, newTime);
      } else if (draggingPoint) {
        onMovePoint(draggingPoint.tierIndex, draggingPoint.pointIndex, newTime);
      }
    };

    const handleMouseUp = () => {
      setDraggingBoundary(null);
      setDraggingPoint(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBoundary, draggingPoint, getTimeFromX, onMoveBoundary, onMovePoint]);

  const handleCommitEdit = () => {
    if (editingTarget) {
      onSetIntervalText(editingTarget.tierIndex, editingTarget.intervalIndex, editText);
      setEditingTarget(null);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingTarget(null);
    }
  };

  // Selection highlight bounds calculation
  const selX0 = selection ? Math.max(0, ((Math.min(selection[0], selection[1]) - tmin) / timeSpan) * 100) : 0;
  const selX1 = selection ? Math.min(100, ((Math.max(selection[0], selection[1]) - tmin) / timeSpan) * 100) : 0;
  const showSelection = selection && Math.abs(selection[1] - selection[0]) > 0.0005 && selX1 > selX0;

  return (
    <div
      ref={containerRef}
      className="flex flex-col w-full bg-white select-none divide-y divide-slate-300 border-t border-slate-300 relative"
    >
      {textGrid.tiers.map((tier, tierIdx) => {
        const isTierSelected = tierIdx === selectedTierIndex;
        const tierHeight = tier.type === 'IntervalTier' ? 44 : 34;

        return (
          <div
            key={`${tier.name}_${tierIdx}`}
            className={`relative flex items-center w-full ${
              isTierSelected ? 'bg-blue-50/20' : 'bg-white'
            }`}
            style={{ height: `${tierHeight}px` }}
          >
            {/* Left Header Tab (Tier Name & Type) */}
            <div className="absolute left-0 top-0 bottom-0 z-20 w-24 shrink-0 flex items-center justify-between border-r border-slate-300 bg-slate-100 px-2 text-[11px] font-semibold text-slate-700 shadow-xs">
              <span className="truncate" title={tier.name}>{tier.name}</span>
              <span className="text-[9px] font-normal text-slate-400">
                {tier.type === 'IntervalTier' ? 'Int' : 'Pt'}
              </span>
            </div>

            {/* Main Interactive Track Area */}
            <div
              className="relative flex-1 h-full ml-24 overflow-hidden bg-white"
              onClick={(e) => {
                // If clicking background (not on an interval/point directly)
                if (e.target === e.currentTarget) {
                  const t = getTimeFromX(e.clientX);
                  if (tier.type === 'IntervalTier') {
                    onAddBoundary(tierIdx, t);
                  } else {
                    onAddPoint(tierIdx, t);
                  }
                }
              }}
            >
              {/* Synchronized Selection Highlight Strip */}
              {showSelection && (
                <div
                  style={{
                    left: `${selX0}%`,
                    width: `${selX1 - selX0}%`,
                  }}
                  className="absolute top-0 bottom-0 pointer-events-none bg-blue-400/15 border-x border-blue-400/30 z-10"
                />
              )}

              {tier.type === 'IntervalTier' ? (
                /* Interval Tier Rendering */
                (tier as IntervalTier).intervals.map((interval, iIdx) => {
                  const x0 = Math.max(0, ((interval.xmin - tmin) / timeSpan) * 100);
                  const x1 = Math.min(100, ((interval.xmax - tmin) / timeSpan) * 100);
                  const widthPct = Math.max(0, x1 - x0);

                  if (x1 < 0 || x0 > 100) return null;

                  const isIntervalSelected =
                    isTierSelected && selectedIntervalIndex === iIdx;
                  const isEditing =
                    editingTarget?.tierIndex === tierIdx &&
                    editingTarget?.intervalIndex === iIdx;

                  return (
                    <div
                      key={interval.id || `tier_${tierIdx}_int_${iIdx}`}
                      style={{
                        left: `${x0}%`,
                        width: `${widthPct}%`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Alt/Ctrl + click adds a boundary at click position
                        if (e.altKey || e.ctrlKey) {
                          const t = getTimeFromX(e.clientX);
                          onAddBoundary(tierIdx, t);
                        } else {
                          onSelectInterval(tierIdx, iIdx);
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingTarget({ tierIndex: tierIdx, intervalIndex: iIdx });
                        setEditText(interval.text);
                      }}
                      className={`absolute top-0 bottom-0 z-20 flex items-center justify-center border-r border-slate-400 cursor-pointer overflow-hidden transition-colors ${
                        isIntervalSelected
                          ? 'bg-blue-100/75 text-blue-900 font-semibold shadow-inner'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                      title="Click to select, double-click to edit text, Alt+click to split"
                    >
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onBlur={handleCommitEdit}
                          onKeyDown={handleEditKeyDown}
                          className="w-full text-center text-xs font-serif bg-white border border-blue-500 rounded px-1 outline-hidden shadow-xs"
                        />
                      ) : (
                        <span className="truncate px-1 font-serif text-xs text-center">
                          {interval.text || ''}
                        </span>
                      )}

                      {/* Boundary Drag Handle on Left Boundary (if not first interval) */}
                      {iIdx > 0 && (
                        <div
                          style={{ left: '-4px' }}
                          className="absolute top-0 bottom-0 w-2 z-30 cursor-col-resize hover:bg-blue-600/50"
                          title="Drag to move boundary. Right-click to remove."
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggingBoundary({
                              tierIndex: tierIdx,
                              intervalIndex: iIdx,
                            });
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRemoveBoundary(tierIdx, iIdx);
                          }}
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                /* Point Tier Rendering */
                (tier as PointTier).points.map((point, pIdx) => {
                  const xPct = ((point.time - tmin) / timeSpan) * 100;
                  if (xPct < 0 || xPct > 100) return null;

                  return (
                    <div
                      key={point.id || `tier_${tierIdx}_pt_${pIdx}`}
                      style={{ left: `${xPct}%` }}
                      className="absolute top-0 bottom-0 z-30 flex flex-col items-center -translate-x-1/2 cursor-col-resize group"
                      title="Drag to move point. Double click to edit mark."
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingPoint({ tierIndex: tierIdx, pointIndex: pIdx });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        const newMark = prompt('Enter point mark:', point.mark);
                        if (newMark !== null) {
                          onSetPointText(tierIdx, pIdx, newMark);
                        }
                      }}
                    >
                      <div className="w-0.5 h-full bg-blue-600 group-hover:bg-blue-800" />
                      <span className="absolute top-0.5 text-[10px] font-serif font-bold text-blue-900 bg-white/95 px-1 rounded shadow-2xs border border-blue-300">
                        {point.mark || '•'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
