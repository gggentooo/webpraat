import React, { useState, useRef, useEffect, useCallback } from 'react';
import type {
  TextGridData,
  IntervalTier,
  PointTier,
} from '../../types/praat';

export const TEXTGRID_TIER_LABEL_WIDTH_PX = 96;

export interface TextGridTiersCanvasProps {
  textGrid: TextGridData;
  tmin: number;
  tmax: number;
  selection: [number, number] | null;
  selectedTierIndex: number;
  selectedIntervalIndex: number | null;
  tierLabelWidthPx?: number;
  playheadTime?: number | null;
  onSelectInterval: (tierIndex: number, intervalIndex: number) => void;
  onAddBoundary: (tierIndex: number, time: number) => void;
  onAddBoundaryAllTiers?: (time: number) => void;
  onMoveBoundary: (tierIndex: number, intervalIndex: number, newTime: number) => void;
  onRemoveBoundary: (tierIndex: number, intervalIndex: number) => void;
  onSetIntervalText: (tierIndex: number, intervalIndex: number, text: string) => void;
  onAddPoint: (tierIndex: number, time: number) => void;
  onMovePoint: (tierIndex: number, pointIndex: number, newTime: number) => void;
  onSetPointText: (tierIndex: number, pointIndex: number, text: string) => void;
  onDragBoundaryStart?: (tierIndex: number, intervalIndex: number) => void;
  onDragBoundaryEnd?: (tierIndex: number, intervalIndex: number) => void;
  onDragPointStart?: (tierIndex: number, pointIndex: number) => void;
  onDragPointEnd?: (tierIndex: number, pointIndex: number) => void;
}

export const TextGridTiersCanvas: React.FC<TextGridTiersCanvasProps> = ({
  textGrid,
  tmin,
  tmax,
  selection,
  selectedTierIndex,
  selectedIntervalIndex,
  tierLabelWidthPx = TEXTGRID_TIER_LABEL_WIDTH_PX,
  playheadTime,
  onSelectInterval,
  onAddBoundary,
  onAddBoundaryAllTiers,
  onMoveBoundary,
  onRemoveBoundary,
  onSetIntervalText,
  onAddPoint,
  onMovePoint,
  onSetPointText,
  onDragBoundaryStart,
  onDragBoundaryEnd,
  onDragPointStart,
  onDragPointEnd,
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
      const trackWidth = Math.max(1, rect.width - tierLabelWidthPx);
      const x = Math.max(0, Math.min(clientX - (rect.left + tierLabelWidthPx), trackWidth));
      return tmin + (x / trackWidth) * timeSpan;
    },
    [tmin, timeSpan, tierLabelWidthPx]
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
      if (draggingBoundary) {
        onDragBoundaryEnd?.(draggingBoundary.tierIndex, draggingBoundary.intervalIndex);
      } else if (draggingPoint) {
        onDragPointEnd?.(draggingPoint.tierIndex, draggingPoint.pointIndex);
      }
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

  // Compute cursor positions for iconic Praat boundary circle buttons
  const cursorTimes: number[] = [];
  if (selection) {
    const s0 = selection[0];
    const s1 = selection[1];
    if (Math.abs(s1 - s0) <= 0.0005) {
      if (s0 >= tmin && s0 <= tmax) cursorTimes.push(s0);
    } else {
      const minS = Math.min(s0, s1);
      const maxS = Math.max(s0, s1);
      if (minS >= tmin && minS <= tmax) cursorTimes.push(minS);
      if (maxS >= tmin && maxS <= tmax) cursorTimes.push(maxS);
    }
  } else if (playheadTime !== null && playheadTime !== undefined && playheadTime >= tmin && playheadTime <= tmax) {
    cursorTimes.push(playheadTime);
  }

  // Check if a boundary or point already exists at given time on a tier
  const hasBoundaryAt = (tier: IntervalTier | PointTier, time: number): boolean => {
    if (tier.type === 'IntervalTier') {
      const intervals = (tier as IntervalTier).intervals;
      for (const interval of intervals) {
        if (Math.abs(interval.xmin - time) < 0.001 || Math.abs(interval.xmax - time) < 0.001) {
          return true;
        }
      }
    } else {
      const points = (tier as PointTier).points;
      for (const pt of points) {
        if (Math.abs(pt.time - time) < 0.001) {
          return true;
        }
      }
    }
    return false;
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col w-full bg-white select-none divide-y divide-slate-300 border-t border-slate-300 relative"
    >
      {/* Iconic Praat Top Master Boundary Bar ("All Tiers" Circle Buttons) */}
      <div className="relative flex items-center w-full h-[18px] bg-slate-100 border-b border-slate-300">
        <div
          style={{ width: `${tierLabelWidthPx}px` }}
          className="absolute left-0 top-0 bottom-0 z-20 shrink-0 flex items-center justify-between border-r border-slate-300 bg-slate-200 px-2 text-[10px] font-semibold text-slate-500 shadow-2xs"
        >
          <span className="truncate">All tiers</span>
          <span className="text-[9px] font-mono text-slate-400">●</span>
        </div>

        <div
          style={{ marginLeft: `${tierLabelWidthPx}px` }}
          className="relative flex-1 h-full overflow-visible bg-slate-100"
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

          {/* Master "All tiers" interactive boundary circle buttons */}
          {cursorTimes.map((cTime, cIdx) => {
            const xPct = ((cTime - tmin) / timeSpan) * 100;
            if (xPct < 0 || xPct > 100) return null;

            return (
              <div
                key={`master_cursor_${cIdx}_${cTime.toFixed(4)}`}
                style={{ left: `${xPct}%` }}
                className="absolute top-0 bottom-0 -translate-x-1/2 flex items-center justify-center z-30 pointer-events-auto"
              >
                <button
                  type="button"
                  title="Add boundary on all tiers at cursor (Cmd/Ctrl+Enter)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddBoundaryAllTiers?.(cTime);
                  }}
                  className="w-3.5 h-3.5 rounded-full border-2 border-red-500 bg-white hover:bg-red-500 hover:border-red-600 active:scale-90 shadow-xs flex items-center justify-center transition-all group cursor-pointer"
                >
                  <span className="w-1 h-1 rounded-full bg-red-500 group-hover:bg-white" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stacked Tiers */}
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
            <div
              style={{ width: `${tierLabelWidthPx}px` }}
              className="absolute left-0 top-0 bottom-0 z-20 shrink-0 flex items-center justify-between border-r border-slate-300 bg-slate-100 px-2 text-[11px] font-semibold text-slate-700 shadow-xs"
            >
              <span className="truncate" title={tier.name}>{tier.name}</span>
              <span className="text-[9px] font-normal text-slate-400">
                {tier.type === 'IntervalTier' ? 'Int' : 'Pt'}
              </span>
            </div>

            {/* Main Interactive Track Area */}
            <div
              style={{ marginLeft: `${tierLabelWidthPx}px` }}
              className="relative flex-1 h-full overflow-hidden bg-white"
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

              {/* Red Cursor Line(s) across tier */}
              {cursorTimes.map((cTime, cIdx) => {
                const xPct = ((cTime - tmin) / timeSpan) * 100;
                if (xPct < 0 || xPct > 100) return null;

                const alreadyHasBoundary = hasBoundaryAt(tier, cTime);

                return (
                  <React.Fragment key={`cursor_line_${cIdx}_${cTime.toFixed(4)}`}>
                    {/* Vertical Cursor Line */}
                    <div
                      style={{ left: `${xPct}%` }}
                      className="absolute top-0 bottom-0 w-px bg-red-400/80 pointer-events-none z-20"
                    />

                    {/* Iconic Praat Boundary Circle Button ("Boundary Ball") */}
                    <div
                      style={{ left: `${xPct}%` }}
                      className="absolute top-1 -translate-x-1/2 z-30 pointer-events-auto"
                    >
                      {alreadyHasBoundary ? (
                        <div
                          title="Boundary already exists at cursor"
                          className="w-2.5 h-2.5 rounded-full bg-slate-400/80 border border-slate-500 shadow-2xs"
                        />
                      ) : (
                        <button
                          type="button"
                          title="Click to add boundary at cursor on this tier (Enter)"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (tier.type === 'IntervalTier') {
                              onAddBoundary(tierIdx, cTime);
                            } else {
                              onAddPoint(tierIdx, cTime);
                            }
                          }}
                          className="w-3 h-3 rounded-full border border-red-500 bg-white hover:bg-red-500 hover:border-red-600 active:scale-90 shadow-2xs flex items-center justify-center transition-all group cursor-pointer"
                        >
                          <span className="w-1 h-1 rounded-full bg-red-500 group-hover:bg-white" />
                        </button>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}

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
                            onDragBoundaryStart?.(tierIdx, iIdx);
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
                        onDragPointStart?.(tierIdx, pIdx);
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
