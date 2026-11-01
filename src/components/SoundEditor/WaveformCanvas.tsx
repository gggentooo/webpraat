import React, { useRef, useEffect, useCallback } from 'react';

export interface WaveformCanvasProps {
  channels: Float64Array[];
  sampleRate: number;
  tmin: number;
  tmax: number;
  selection: [number, number] | null;
  playheadTime: number | null;
  onSelect: (start: number, end: number) => void;
  onSeek: (time: number) => void;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  channels,
  sampleRate,
  tmin,
  tmax,
  selection,
  playheadTime,
  onSelect,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<number | null>(null);

  // Render canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width <= 0 || height <= 0) return;

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const numChannels = channels.length > 0 ? channels.length : 1;
    const trackHeight = height / numChannels;
    const timeSpan = tmax - tmin;

    if (timeSpan <= 0) {
      ctx.restore();
      return;
    }

    // 2. Render each channel waveform
    for (let ch = 0; ch < numChannels; ++ch) {
      const trackTop = ch * trackHeight;
      const trackCenter = trackTop + trackHeight / 2;
      const samples = channels[ch] || new Float64Array(0);
      const numSamples = samples.length;

      // Divider line between stereo channels
      if (ch > 0) {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, trackTop);
        ctx.lineTo(width, trackTop);
        ctx.stroke();
      }

      // Center zero-crossing line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, trackCenter);
      ctx.lineTo(width, trackCenter);
      ctx.stroke();
      ctx.setLineDash([]);

      // Channel label and amplitude bounds
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText(numChannels > 1 ? `Ch ${ch + 1}` : '1.0', 4, trackTop + 11);
      ctx.fillText('-1.0', 4, trackTop + trackHeight - 4);

      if (numSamples === 0) continue;

      // Min-Max sample decimation for 60fps rendering
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.beginPath();

      const samplesPerPixel = (timeSpan * sampleRate) / width;

      if (samplesPerPixel <= 1.0) {
        // Detailed sample line interpolation
        let first = true;
        for (let px = 0; px < width; ++px) {
          const t = tmin + (px / width) * timeSpan;
          const sIdx = Math.round(t * sampleRate);
          if (sIdx >= 0 && sIdx < numSamples) {
            const val = samples[sIdx];
            const y = trackCenter - val * (trackHeight * 0.45);
            if (first) {
              ctx.moveTo(px, y);
              first = false;
            } else {
              ctx.lineTo(px, y);
            }
          }
        }
        ctx.stroke();
      } else {
        // Min-max column bars
        for (let px = 0; px < width; ++px) {
          const t0 = tmin + (px / width) * timeSpan;
          const t1 = tmin + ((px + 1) / width) * timeSpan;

          let s0 = Math.floor(t0 * sampleRate);
          let s1 = Math.ceil(t1 * sampleRate);

          if (s1 < 0 || s0 >= numSamples) continue;
          s0 = Math.max(0, s0);
          s1 = Math.min(numSamples - 1, s1);

          let minVal = samples[s0];
          let maxVal = samples[s0];

          // Sample stride if span is huge
          const step = Math.max(1, Math.floor((s1 - s0) / 100));
          for (let s = s0; s <= s1; s += step) {
            const val = samples[s];
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
          }

          const yMax = trackCenter - maxVal * (trackHeight * 0.45);
          const yMin = trackCenter - minVal * (trackHeight * 0.45);

          ctx.moveTo(px, Math.min(yMax, yMin));
          ctx.lineTo(px, Math.max(yMax, yMin) + 0.5);
        }
        ctx.stroke();
      }
    }

    // 3. Selection Range Highlight
    if (selection) {
      const [selStart, selEnd] = selection;
      const sStart = Math.min(selStart, selEnd);
      const sEnd = Math.max(selStart, selEnd);

      if (sEnd > tmin && sStart < tmax) {
        const xStart = Math.max(0, ((sStart - tmin) / timeSpan) * width);
        const xEnd = Math.min(width, ((sEnd - tmin) / timeSpan) * width);
        const selWidth = Math.max(1, xEnd - xStart);

        ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.fillRect(xStart, 0, selWidth, height);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        if (sStart >= tmin && sStart <= tmax) {
          ctx.beginPath();
          ctx.moveTo(xStart, 0);
          ctx.lineTo(xStart, height);
          ctx.stroke();
        }
        if (sEnd >= tmin && sEnd <= tmax && sEnd !== sStart) {
          ctx.beginPath();
          ctx.moveTo(xEnd, 0);
          ctx.lineTo(xEnd, height);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
    }

    // 4. Playhead Cursor
    if (playheadTime !== null && playheadTime >= tmin && playheadTime <= tmax) {
      const xPlay = ((playheadTime - tmin) / timeSpan) * width;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xPlay, 0);
      ctx.lineTo(xPlay, height);
      ctx.stroke();
    }

    ctx.restore();
  }, [channels, sampleRate, tmin, tmax, selection, playheadTime]);

  // Redraw on dependencies
  useEffect(() => {
    render();
  }, [render]);

  // Window resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      render();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [render]);

  // Mouse handlers for selection and seeking
  const getTimeFromX = (clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return tmin;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const timeSpan = tmax - tmin;
    return tmin + (x / rect.width) * timeSpan;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const t = getTimeFromX(e.clientX);
    isDraggingRef.current = true;
    dragStartRef.current = t;
    onSelect(t, t);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || dragStartRef.current === null) return;
    const t = getTimeFromX(e.clientX);
    const start = Math.min(dragStartRef.current, t);
    const end = Math.max(dragStartRef.current, t);
    onSelect(start, end);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const t = getTimeFromX(e.clientX);

    if (dragStartRef.current !== null) {
      const diff = Math.abs(t - dragStartRef.current);
      if (diff < (tmax - tmin) * 0.005) {
        // Single point click -> seek & cursor
        onSeek(dragStartRef.current);
        onSelect(dragStartRef.current, dragStartRef.current);
      } else {
        const start = Math.min(dragStartRef.current, t);
        const end = Math.max(dragStartRef.current, t);
        onSelect(start, end);
      }
    }
    dragStartRef.current = null;
  };

  return (
    <div className="relative h-full w-full select-none cursor-crosshair overflow-hidden">
      <canvas
        ref={canvasRef}
        className="h-full w-full block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
};
