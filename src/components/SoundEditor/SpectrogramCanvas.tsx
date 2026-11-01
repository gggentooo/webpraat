import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import type {
  SpectrogramData,
  PitchTrack,
  FormantTrack,
  IntensityTrack,
} from '../../types/wasm';

export interface SpectrogramCanvasProps {
  spectrogram: SpectrogramData | null;
  pitch: PitchTrack | null;
  formants: FormantTrack | null;
  intensity: IntensityTrack | null;
  showSpectrogram?: boolean;
  showPitch?: boolean;
  showFormants?: boolean;
  showIntensity?: boolean;
  colorMap?: 'greyscale' | 'colour';
  dynamicRange?: number;
  preemphasis?: number;
  maxFrequency?: number;
  tmin: number;
  tmax: number;
  selection: [number, number] | null;
  playheadTime: number | null;
  onSelect: (start: number, end: number) => void;
  onSeek: (time: number) => void;
}

export const SpectrogramCanvas: React.FC<SpectrogramCanvasProps> = ({
  spectrogram,
  pitch,
  formants,
  intensity,
  showSpectrogram = true,
  showPitch = true,
  showFormants = true,
  showIntensity = false,
  colorMap = 'greyscale',
  dynamicRange = 50.0,
  preemphasis = 6.0,
  maxFrequency = 5000.0,
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

  // Pre-generate offscreen canvas for spectrogram bitmap
  const spectrogramBitmap = useMemo(() => {
    if (!spectrogram || !showSpectrogram) return null;

    const { nx, ny, z, dy, y1 } = spectrogram;
    if (nx <= 0 || ny <= 0) return null;

    // Convert PSD matrix to dB values with pre-emphasis
    const dbMatrix = new Float64Array(nx * ny);
    let maxDb = -Infinity;

    const numLn2 = Math.LN2;
    const numLn10 = Math.LN10;
    const oneByRef = 1.0 / 4.0e-10;

    for (let iy = 0; iy < ny; ++iy) {
      const freq = y1 + iy * dy;
      const preemphasisTerm =
        (preemphasis / numLn2) * Math.log(Math.max(0, freq) / 1000.0 + 1e-308);

      for (let ix = 0; ix < nx; ++ix) {
        const psd = z[iy * nx + ix];
        const psdDb =
          (10.0 / numLn10) * Math.log(oneByRef * psd + 1e-308) + preemphasisTerm;
        dbMatrix[iy * nx + ix] = psdDb;
        if (psdDb > maxDb) {
          maxDb = psdDb;
        }
      }
    }

    const minDb = maxDb - dynamicRange;
    const range = dynamicRange > 0 ? dynamicRange : 1.0;

    // Offscreen canvas: width = nx, height = ny
    const offscreen = document.createElement('canvas');
    offscreen.width = nx;
    offscreen.height = ny;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return null;

    const imgData = offCtx.createImageData(nx, ny);
    const data = imgData.data;

    // Flip vertically so row 0 is at top (high frequency) and row ny-1 is at bottom (low frequency)
    for (let iy = 0; iy < ny; ++iy) {
      const srcIy = iy; // 0 = lowest freq, ny-1 = highest freq
      const destY = ny - 1 - iy; // Canvas row: 0 = top (highest freq), ny-1 = bottom (lowest freq)

      for (let ix = 0; ix < nx; ++ix) {
        const db = dbMatrix[srcIy * nx + ix];
        const norm = Math.max(0, Math.min(1, (db - minDb) / range));
        const pIdx = (destY * nx + ix) * 4;

        if (colorMap === 'greyscale') {
          const grey = Math.round((1.0 - norm) * 255);
          data[pIdx] = grey;
          data[pIdx + 1] = grey;
          data[pIdx + 2] = grey;
          data[pIdx + 3] = 255;
        } else {
          // Colour map (White -> Blue -> Cyan -> Yellow -> Red -> Black)
          let r = 255;
          let g = 255;
          let b = 255;

          if (norm < 0.25) {
            const f = norm / 0.25;
            r = Math.round(255 * (1 - f));
            g = Math.round(255 * (1 - 0.2 * f));
            b = 255;
          } else if (norm < 0.5) {
            const f = (norm - 0.25) / 0.25;
            r = 0;
            g = 255;
            b = Math.round(255 * (1 - f));
          } else if (norm < 0.75) {
            const f = (norm - 0.5) / 0.25;
            r = Math.round(255 * f);
            g = Math.round(255 * (1 - 0.4 * f));
            b = 0;
          } else {
            const f = (norm - 0.75) / 0.25;
            r = Math.round(255 * (1 - 0.6 * f));
            g = 0;
            b = 0;
          }

          data[pIdx] = r;
          data[pIdx + 1] = g;
          data[pIdx + 2] = b;
          data[pIdx + 3] = 255;
        }
      }
    }

    offCtx.putImageData(imgData, 0, 0);
    return offscreen;
  }, [spectrogram, showSpectrogram, colorMap, dynamicRange, preemphasis]);

  // Main rendering routine
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

    const timeSpan = tmax - tmin;
    if (timeSpan <= 0) {
      ctx.restore();
      return;
    }

    // 2. Spectrogram image
    if (showSpectrogram && spectrogramBitmap && spectrogram) {
      const { xmin, xmax } = spectrogram;
      const spectroDuration = xmax - xmin;

      if (spectroDuration > 0) {
        // Calculate source rectangle from offscreen canvas for visible viewport
        const sw = spectrogramBitmap.width;
        const sh = spectrogramBitmap.height;

        const srcX0 = Math.max(0, ((tmin - xmin) / spectroDuration) * sw);
        const srcX1 = Math.min(sw, ((tmax - xmin) / spectroDuration) * sw);
        const srcW = Math.max(1, srcX1 - srcX0);

        ctx.drawImage(
          spectrogramBitmap,
          srcX0,
          0,
          srcW,
          sh,
          0,
          0,
          width,
          height
        );
      }
    }

    // 3. Grid lines & Frequency axis markings (0 Hz to maxFrequency)
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';

    const freqStep = 1000;
    for (let f = freqStep; f <= maxFrequency; f += freqStep) {
      const y = height - (f / maxFrequency) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillText(`${f} Hz`, 4, y - 2);
    }

    // 4. Formant Tracks Overlay (Red Dots)
    if (showFormants && formants) {
      const { nx, dx, x1, maxnFormants, frequencies } = formants;
      ctx.fillStyle = '#ef4444'; // Red formant dots

      for (let i = 1; i <= nx; ++i) {
        const t = x1 + (i - 1) * dx;
        if (t < tmin || t > tmax) continue;

        const x = ((t - tmin) / timeSpan) * width;

        // Draw F1, F2, F3, F4 dots
        const numPairs = Math.min(4, maxnFormants);
        for (let k = 0; k < numPairs; ++k) {
          const f = frequencies[(i - 1) * maxnFormants + k];
          if (f > 50 && f <= maxFrequency) {
            const y = height - (f / maxFrequency) * height;
            ctx.beginPath();
            ctx.arc(x, y, 2.0, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      }
    }

    // 5. Pitch Contour Overlay (Blue Path)
    if (showPitch && pitch) {
      const { nx, dx, x1, frequencies } = pitch;
      const pitchFloor = 75.0;
      const pitchCeiling = 500.0;
      const pitchRange = pitchCeiling - pitchFloor;

      ctx.strokeStyle = '#2563eb'; // Blue pitch line
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      let inSegment = false;
      ctx.beginPath();

      for (let i = 1; i <= nx; ++i) {
        const t = x1 + (i - 1) * dx;
        if (t < tmin || t > tmax) continue;

        const f0 = frequencies[i - 1];
        const x = ((t - tmin) / timeSpan) * width;

        if (f0 >= pitchFloor && f0 <= pitchCeiling) {
          const y = height - ((f0 - pitchFloor) / pitchRange) * height;
          if (!inSegment) {
            ctx.moveTo(x, y);
            inSegment = true;
          } else {
            ctx.lineTo(x, y);
          }
        } else {
          inSegment = false;
        }
      }
      ctx.stroke();

      // Right-side Pitch Scale Marking
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`${pitchCeiling} Hz`, width - 54, 12);
      ctx.fillText(`${pitchFloor} Hz`, width - 50, height - 4);
    }

    // 6. Intensity Curve Overlay (Green Line)
    if (showIntensity && intensity) {
      const { nx, dx, x1, values } = intensity;
      const minIntensity = 50.0;
      const maxIntensity = 100.0;
      const intRange = maxIntensity - minIntensity;

      ctx.strokeStyle = '#16a34a'; // Green intensity line
      ctx.lineWidth = 1.6;
      ctx.setLineDash([2, 1]);

      let first = true;
      ctx.beginPath();

      for (let i = 1; i <= nx; ++i) {
        const t = x1 + (i - 1) * dx;
        if (t < tmin || t > tmax) continue;

        const val = values[i - 1];
        const x = ((t - tmin) / timeSpan) * width;
        const y = height - ((val - minIntensity) / intRange) * height;

        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Right-side Intensity Scale Marking
      ctx.fillStyle = '#16a34a';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('100 dB', width - 42, 24);
      ctx.fillText('50 dB', width - 38, height - 16);
    }

    // 7. Selection Range Highlight
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

    // 8. Playhead Cursor
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
  }, [
    spectrogramBitmap,
    spectrogram,
    pitch,
    formants,
    intensity,
    showSpectrogram,
    showPitch,
    showFormants,
    showIntensity,
    maxFrequency,
    tmin,
    tmax,
    selection,
    playheadTime,
  ]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => {
      render();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [render]);

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
