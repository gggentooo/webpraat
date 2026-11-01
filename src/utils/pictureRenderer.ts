/**
 * Praat Picture Vector & Raster Rendering Engine (Phase 7).
 * Supports Praat's 12" × 12" page coordinate system, outer/inner viewports,
 * garnish axes, acoustic object plots, drawing primitives, SVG vector export,
 * high-DPI PNG export, and Praat Picture script command parsing.
 */

import type {
  PictureCommand,
  PictureLineType,
  PicturePenSettings,
  PictureViewport,
  PraatColour,
} from '../types/praat';

export const PAGE_INCHES = 12;
export const SVG_POINTS_PER_INCH = 72; // 12 * 72 = 864 x 864 pt

export const PRAAT_COLOUR_HEX: Record<PraatColour, string> = {
  Black: '#000000',
  White: '#ffffff',
  Red: '#dc2626',
  Green: '#16a34a',
  Blue: '#1d4ed8',
  Cyan: '#0891b2',
  Magenta: '#c026d3',
  Yellow: '#eab308',
  Maroon: '#7f1d1d',
  Lime: '#65a30d',
  Navy: '#1e3a8a',
  Teal: '#0f766e',
  Purple: '#7e22ce',
  Olive: '#4d7c0f',
  Silver: '#cbd5e1',
  Grey: '#64748b',
};

export const PRAAT_COLOURS_LIST: PraatColour[] = [
  'Black',
  'Red',
  'Blue',
  'Green',
  'Magenta',
  'Cyan',
  'Maroon',
  'Navy',
  'Teal',
  'Purple',
  'Olive',
  'Grey',
  'Silver',
  'Yellow',
  'Lime',
  'White',
];

export interface InnerBoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Computes the inner drawing box inside an outer viewport (in target pixel/point units).
 */
export function computeInnerBox(
  viewport: PictureViewport,
  scalePerInch: number,
  garnish: boolean
): InnerBoxRect {
  const vx1 = Math.min(viewport.x1, viewport.x2);
  const vx2 = Math.max(viewport.x1, viewport.x2);
  const vy1 = Math.min(viewport.y1, viewport.y2);
  const vy2 = Math.max(viewport.y1, viewport.y2);

  const vw = Math.max(0.25, vx2 - vx1);
  const vh = Math.max(0.25, vy2 - vy1);

  const marginLeft = garnish ? Math.min(0.55, vw * 0.16) : Math.min(0.08, vw * 0.03);
  const marginRight = garnish ? Math.min(0.22, vw * 0.06) : Math.min(0.08, vw * 0.03);
  const marginTop = garnish ? Math.min(0.32, vh * 0.14) : Math.min(0.08, vh * 0.03);
  const marginBottom = garnish ? Math.min(0.38, vh * 0.16) : Math.min(0.08, vh * 0.03);

  return {
    x: (vx1 + marginLeft) * scalePerInch,
    y: (vy1 + marginTop) * scalePerInch,
    w: Math.max(4, (vw - marginLeft - marginRight) * scalePerInch),
    h: Math.max(4, (vh - marginTop - marginBottom) * scalePerInch),
  };
}

export function getLineDashPattern(lineType: PictureLineType, scale = 1): number[] {
  switch (lineType) {
    case 'dotted':
      return [2 * scale, 3 * scale];
    case 'dashed':
      return [6 * scale, 4 * scale];
    case 'dash-dotted':
      return [7 * scale, 3 * scale, 2 * scale, 3 * scale];
    case 'solid':
    default:
      return [];
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatAxisNumber(val: number): string {
  if (!Number.isFinite(val)) return '0';
  if (Math.abs(val) >= 100) return Math.round(val).toString();
  if (Math.abs(val) >= 10) return Number(val.toFixed(1)).toString();
  return Number(val.toFixed(3)).toString();
}

/**
 * Computes RGBA pixel bytes for a Praat Spectrogram matrix.
 */
function buildSpectrogramRgba(
  cmd: Extract<PictureCommand, { kind: 'spectrogram' }>,
  imgW: number,
  imgH: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(imgW * imgH * 4);
  const { nx, ny, y1, dy, z, maxFreq, dynamicRange, preemphasis, colorMap } = cmd;
  if (nx <= 0 || ny <= 0 || z.length === 0) return out;

  const preFactor = preemphasis / Math.LN10;
  let maxDb = -Infinity;
  const dbMatrix = new Float32Array(ny * nx);

  for (let iy = 0; iy < ny; iy++) {
    const freq = y1 + iy * dy;
    const preDb = freq > 0 ? preFactor * Math.log(freq / 1000.0) : 0;
    const rowOff = iy * nx;
    for (let ix = 0; ix < nx; ix++) {
      const val = z[rowOff + ix];
      const rawDb = val > 1e-30 ? 10.0 * Math.log10(val / 4e-10) : -300.0;
      const db = rawDb + preDb;
      dbMatrix[rowOff + ix] = db;
      if (freq <= maxFreq && db > maxDb) {
        maxDb = db;
      }
    }
  }

  if (!Number.isFinite(maxDb)) maxDb = 100;
  const minDb = maxDb - (dynamicRange > 0 ? dynamicRange : 50);

  for (let py = 0; py < imgH; py++) {
    const freq = maxFreq * (1.0 - py / Math.max(1, imgH - 1));
    const iy = Math.max(0, Math.min(ny - 1, Math.round((freq - y1) / (dy || 1))));
    const rowOff = iy * nx;

    for (let px = 0; px < imgW; px++) {
      const ix = Math.max(0, Math.min(nx - 1, Math.floor((px / Math.max(1, imgW - 1)) * (nx - 1))));
      const db = dbMatrix[rowOff + ix];
      const norm = Math.max(0, Math.min(1, (db - minDb) / Math.max(1e-6, maxDb - minDb)));
      const pIdx = (py * imgW + px) * 4;

      if (colorMap === 'colour') {
        // Praat-style perceptual heat LUT (white -> blue -> magenta -> red -> yellow)
        let r = 255;
        let g = 255;
        let b = 255;
        if (norm < 0.25) {
          const t = norm / 0.25;
          r = Math.round(255 * (1 - t));
          g = Math.round(255 * (1 - t * 0.7));
          b = 255;
        } else if (norm < 0.55) {
          const t = (norm - 0.25) / 0.3;
          r = Math.round(200 * t);
          g = Math.round(76 * (1 - t));
          b = Math.round(255 * (1 - 0.3 * t));
        } else if (norm < 0.85) {
          const t = (norm - 0.55) / 0.3;
          r = Math.round(200 + 55 * t);
          g = Math.round(140 * t);
          b = Math.round(178 * (1 - t));
        } else {
          const t = (norm - 0.85) / 0.15;
          r = 255;
          g = Math.round(140 + 115 * t);
          b = Math.round(60 * t);
        }
        out[pIdx] = r;
        out[pIdx + 1] = g;
        out[pIdx + 2] = b;
        out[pIdx + 3] = 255;
      } else {
        const shade = Math.round(255 * (1.0 - norm));
        out[pIdx] = shade;
        out[pIdx + 1] = shade;
        out[pIdx + 2] = shade;
        out[pIdx + 3] = 255;
      }
    }
  }

  return out;
}

/**
 * Pure TypeScript 24-bit BMP Base64 data URI encoder so Spectrograms embed cleanly in SVG
 * in both Browser and headless Node/Vitest environments without DOM dependencies.
 */
function encodeRgbaToBmpDataUri(rgba: Uint8ClampedArray, width: number, height: number): string {
  const rowStride = (width * 3 + 3) & ~3;
  const pixelBytes = rowStride * height;
  const fileSize = 54 + pixelBytes;
  const buf = new Uint8Array(fileSize);
  const view = new DataView(buf.buffer);

  // BMP Header
  buf[0] = 0x42; // 'B'
  buf[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);

  // DIB BITMAPINFOHEADER
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, -height, true); // top-down
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelBytes, true);

  for (let y = 0; y < height; y++) {
    const dstRow = 54 + y * rowStride;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = dstRow + x * 3;
      buf[dstIdx] = rgba[srcIdx + 2];     // B
      buf[dstIdx + 1] = rgba[srcIdx + 1]; // G
      buf[dstIdx + 2] = rgba[srcIdx];     // R
    }
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < buf.length; i += chunkSize) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  return `data:image/bmp;base64,${base64}`;
}

function drawCanvasGarnish(
  ctx: CanvasRenderingContext2D,
  box: InnerBoxRect,
  scalePerInch: number,
  pen: PicturePenSettings,
  title: string,
  xMinLabel: string,
  xMaxLabel: string,
  xUnitLabel: string,
  yMinLabel: string,
  yMaxLabel: string,
  yUnitLabel: string
): void {
  if (!pen.garnish) return;

  const pt = scalePerInch / 72;
  const fontPx = Math.max(9, Math.round(pen.fontSize * 0.85 * pt));

  ctx.save();
  ctx.strokeStyle = '#0f172a';
  ctx.fillStyle = '#0f172a';
  ctx.lineWidth = Math.max(1, 1 * pt);
  ctx.setLineDash([]);
  ctx.strokeRect(box.x, box.y, box.w, box.h);

  const tickLen = Math.max(3, 4 * pt);
  // Ticks
  ctx.beginPath();
  ctx.moveTo(box.x, box.y + box.h);
  ctx.lineTo(box.x, box.y + box.h + tickLen);
  ctx.moveTo(box.x + box.w, box.y + box.h);
  ctx.lineTo(box.x + box.w, box.y + box.h + tickLen);
  ctx.moveTo(box.x - tickLen, box.y);
  ctx.lineTo(box.x, box.y);
  ctx.moveTo(box.x - tickLen, box.y + box.h);
  ctx.lineTo(box.x, box.y + box.h);
  ctx.stroke();

  ctx.font = `${fontPx}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(xMinLabel, box.x, box.y + box.h + tickLen + 2);
  ctx.textAlign = 'right';
  ctx.fillText(xMaxLabel, box.x + box.w, box.y + box.h + tickLen + 2);
  ctx.textAlign = 'center';
  ctx.fillText(xUnitLabel, box.x + box.w / 2, box.y + box.h + tickLen + fontPx * 0.9);

  // Y labels
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(yMaxLabel, box.x - tickLen - 3, box.y);
  ctx.textBaseline = 'bottom';
  ctx.fillText(yMinLabel, box.x - tickLen - 3, box.y + box.h);

  // Rotated Y unit
  if (yUnitLabel) {
    ctx.save();
    ctx.translate(box.x - tickLen - fontPx * 2.2, box.y + box.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(yUnitLabel, 0, 0);
    ctx.restore();
  }

  // Title
  if (title) {
    ctx.font = `600 ${Math.round(fontPx * 1.05)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(title, box.x + box.w / 2, box.y - 4 * pt);
  }

  ctx.restore();
}

/**
 * Renders the Praat Picture command list onto a 2D HTML5 Canvas.
 */
export function renderPictureToCanvas(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  commands: PictureCommand[],
  selectedViewport?: PictureViewport,
  showInteractiveGrid = true
): void {
  const size = Math.min(canvasWidth, canvasHeight);
  const scalePerInch = size / PAGE_INCHES;
  const pt = scalePerInch / 72;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Subtle 1-inch ruler grid when rendering in interactive UI mode
  if (showInteractiveGrid) {
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (let i = 1; i < PAGE_INCHES; i++) {
      const pos = Math.round(i * scalePerInch) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }
  }

  for (const cmd of commands) {
    const box = computeInnerBox(cmd.viewport, scalePerInch, cmd.pen.garnish);
    const strokeHex = PRAAT_COLOUR_HEX[cmd.pen.colour] ?? '#000000';
    const dash = getLineDashPattern(cmd.pen.lineType, pt);
    const strokeW = Math.max(0.75, cmd.pen.lineWidth * pt);

    if (cmd.kind === 'waveform') {
      const { samples, tmin, tmax } = cmd;
      let { minAmp, maxAmp } = cmd;
      if (minAmp === 0 && maxAmp === 0) {
        let peak = 1e-4;
        for (let i = 0; i < samples.length; i++) {
          const a = Math.abs(samples[i]);
          if (a > peak) peak = a;
        }
        minAmp = -peak;
        maxAmp = peak;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();

      // Zero axis
      if (minAmp < 0 && maxAmp > 0) {
        const yZero = box.y + box.h * (maxAmp / (maxAmp - minAmp));
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.setLineDash([3 * pt, 3 * pt]);
        ctx.beginPath();
        ctx.moveTo(box.x, yZero);
        ctx.lineTo(box.x + box.w, yZero);
        ctx.stroke();
      }

      if (samples.length > 0) {
        ctx.strokeStyle = strokeHex;
        ctx.lineWidth = strokeW;
        ctx.setLineDash(dash);
        ctx.beginPath();
        const step = Math.max(1, Math.floor(samples.length / Math.max(400, Math.round(box.w * 2))));
        for (let i = 0; i < samples.length; i += step) {
          const x = box.x + (i / Math.max(1, samples.length - 1)) * box.w;
          const normY = (maxAmp - samples[i]) / Math.max(1e-9, maxAmp - minAmp);
          const y = box.y + normY * box.h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();

      drawCanvasGarnish(
        ctx,
        box,
        scalePerInch,
        cmd.pen,
        cmd.title,
        formatAxisNumber(tmin),
        formatAxisNumber(tmax),
        'Time (s)',
        formatAxisNumber(minAmp),
        formatAxisNumber(maxAmp),
        'Amplitude'
      );
    } else if (cmd.kind === 'spectrogram') {
      const imgW = Math.max(16, Math.min(600, Math.round(box.w)));
      const imgH = Math.max(16, Math.min(400, Math.round(box.h)));
      const rgba = buildSpectrogramRgba(cmd, imgW, imgH);

      if (typeof document !== 'undefined') {
        const off = document.createElement('canvas');
        off.width = imgW;
        off.height = imgH;
        const offCtx = off.getContext('2d');
        if (offCtx) {
          const imageData = offCtx.createImageData(imgW, imgH);
          imageData.data.set(rgba);
          offCtx.putImageData(imageData, 0, 0);
          ctx.drawImage(off, box.x, box.y, box.w, box.h);
        }
      }

      drawCanvasGarnish(
        ctx,
        box,
        scalePerInch,
        cmd.pen,
        cmd.title,
        formatAxisNumber(cmd.tmin),
        formatAxisNumber(cmd.tmax),
        'Time (s)',
        '0',
        formatAxisNumber(cmd.maxFreq),
        'Frequency (Hz)'
      );
    } else if (cmd.kind === 'pitch') {
      const { frequencies, x1, dx, tmin, tmax, fmin, fmax } = cmd;
      const dur = Math.max(1e-6, tmax - tmin);
      const fSpan = Math.max(1, fmax - fmin);

      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.strokeStyle = strokeHex;
      ctx.lineWidth = Math.max(1.25, strokeW);
      ctx.setLineDash(dash);

      let inSegment = false;
      ctx.beginPath();
      for (let i = 0; i < frequencies.length; i++) {
        const f = frequencies[i];
        const t = x1 + i * dx;
        if (f > 0 && f >= fmin && f <= fmax && t >= tmin && t <= tmax) {
          const x = box.x + ((t - tmin) / dur) * box.w;
          const y = box.y + (1 - (f - fmin) / fSpan) * box.h;
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
      ctx.restore();

      drawCanvasGarnish(
        ctx,
        box,
        scalePerInch,
        cmd.pen,
        cmd.title,
        formatAxisNumber(tmin),
        formatAxisNumber(tmax),
        'Time (s)',
        formatAxisNumber(fmin),
        formatAxisNumber(fmax),
        'Pitch (Hz)'
      );
    } else if (cmd.kind === 'formants') {
      const { frequencies, x1, dx, maxnFormants, tmin, tmax, maxFreq, speckle } = cmd;
      const dur = Math.max(1e-6, tmax - tmin);
      const nFrames = maxnFormants > 0 ? Math.floor(frequencies.length / maxnFormants) : 0;

      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.fillStyle = strokeHex;
      ctx.strokeStyle = strokeHex;
      ctx.lineWidth = strokeW;
      ctx.setLineDash(dash);

      if (speckle) {
        const radius = Math.max(1.2, 1.8 * pt);
        for (let i = 0; i < nFrames; i++) {
          const t = x1 + i * dx;
          if (t < tmin || t > tmax) continue;
          const x = box.x + ((t - tmin) / dur) * box.w;
          for (let fIdx = 0; fIdx < maxnFormants; fIdx++) {
            const freq = frequencies[i * maxnFormants + fIdx];
            if (freq > 0 && freq <= maxFreq) {
              const y = box.y + (1 - freq / maxFreq) * box.h;
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      } else {
        for (let fIdx = 0; fIdx < maxnFormants; fIdx++) {
          let open = false;
          ctx.beginPath();
          for (let i = 0; i < nFrames; i++) {
            const t = x1 + i * dx;
            const freq = frequencies[i * maxnFormants + fIdx];
            if (t >= tmin && t <= tmax && freq > 0 && freq <= maxFreq) {
              const x = box.x + ((t - tmin) / dur) * box.w;
              const y = box.y + (1 - freq / maxFreq) * box.h;
              if (!open) {
                ctx.moveTo(x, y);
                open = true;
              } else {
                ctx.lineTo(x, y);
              }
            } else {
              open = false;
            }
          }
          ctx.stroke();
        }
      }
      ctx.restore();

      drawCanvasGarnish(
        ctx,
        box,
        scalePerInch,
        cmd.pen,
        cmd.title,
        formatAxisNumber(tmin),
        formatAxisNumber(tmax),
        'Time (s)',
        '0',
        formatAxisNumber(maxFreq),
        'Formant (Hz)'
      );
    } else if (cmd.kind === 'intensity' || cmd.kind === 'cpp') {
      const { values, x1, dx, tmin, tmax } = cmd;
      let { minDb, maxDb } = cmd;
      if (minDb === 0 && maxDb === 0 && values.length > 0) {
        minDb = Infinity;
        maxDb = -Infinity;
        for (let i = 0; i < values.length; i++) {
          const v = values[i];
          if (Number.isFinite(v)) {
            if (v < minDb) minDb = v;
            if (v > maxDb) maxDb = v;
          }
        }
        if (!Number.isFinite(minDb) || minDb === maxDb) {
          minDb = 0;
          maxDb = 100;
        } else {
          const pad = (maxDb - minDb) * 0.1 || 5;
          minDb -= pad;
          maxDb += pad;
        }
      }
      const dur = Math.max(1e-6, tmax - tmin);
      const dbSpan = Math.max(1e-6, maxDb - minDb);

      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();
      ctx.strokeStyle = strokeHex;
      ctx.lineWidth = Math.max(1.2, strokeW);
      ctx.setLineDash(dash);
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        const t = x1 + i * dx;
        if (Number.isFinite(v) && t >= tmin && t <= tmax) {
          const x = box.x + ((t - tmin) / dur) * box.w;
          const y = box.y + (1 - (v - minDb) / dbSpan) * box.h;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      ctx.restore();

      drawCanvasGarnish(
        ctx,
        box,
        scalePerInch,
        cmd.pen,
        cmd.title,
        formatAxisNumber(tmin),
        formatAxisNumber(tmax),
        'Time (s)',
        formatAxisNumber(minDb),
        formatAxisNumber(maxDb),
        cmd.kind === 'cpp' ? 'CPP (dB)' : 'Intensity (dB)'
      );
    } else if (cmd.kind === 'textgrid') {
      const { data, tmin, tmax } = cmd;
      const tiers = data.tiers;
      const dur = Math.max(1e-6, tmax - tmin);
      const nTiers = Math.max(1, tiers.length);
      const tierH = box.h / nTiers;
      const fontPx = Math.max(9, Math.round(cmd.pen.fontSize * 0.85 * pt));

      ctx.save();
      ctx.strokeStyle = strokeHex;
      ctx.fillStyle = strokeHex;
      ctx.lineWidth = strokeW;
      ctx.font = `${fontPx}px ui-sans-serif, system-ui, sans-serif`;

      tiers.forEach((tier, idx) => {
        const yTop = box.y + idx * tierH;
        if (idx > 0) {
          ctx.beginPath();
          ctx.moveTo(box.x, yTop);
          ctx.lineTo(box.x + box.w, yTop);
          ctx.stroke();
        }

        if (tier.type === 'IntervalTier') {
          for (const iv of tier.intervals) {
            if (iv.xmax < tmin || iv.xmin > tmax) continue;
            const xLeft = box.x + (Math.max(tmin, iv.xmin) - tmin) / dur * box.w;
            const xRight = box.x + (Math.min(tmax, iv.xmax) - tmin) / dur * box.w;
            if (iv.xmin > tmin) {
              ctx.strokeStyle = '#1d4ed8';
              ctx.beginPath();
              ctx.moveTo(xLeft, yTop);
              ctx.lineTo(xLeft, yTop + tierH);
              ctx.stroke();
            }
            if (iv.text) {
              ctx.fillStyle = strokeHex;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(iv.text, (xLeft + xRight) / 2, yTop + tierH / 2);
            }
          }
        } else {
          for (const ptItem of tier.points) {
            if (ptItem.time < tmin || ptItem.time > tmax) continue;
            const xPos = box.x + ((ptItem.time - tmin) / dur) * box.w;
            ctx.strokeStyle = '#1d4ed8';
            ctx.beginPath();
            ctx.moveTo(xPos, yTop);
            ctx.lineTo(xPos, yTop + tierH * 0.3);
            ctx.moveTo(xPos, yTop + tierH * 0.7);
            ctx.lineTo(xPos, yTop + tierH);
            ctx.stroke();
            if (ptItem.mark) {
              ctx.fillStyle = strokeHex;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(ptItem.mark, xPos, yTop + tierH / 2);
            }
          }
        }

        // Tier name on right
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(tier.name, box.x + box.w + 4 * pt, yTop + tierH / 2);
      });
      ctx.restore();

      drawCanvasGarnish(
        ctx,
        box,
        scalePerInch,
        cmd.pen,
        cmd.title,
        formatAxisNumber(tmin),
        formatAxisNumber(tmax),
        'Time (s)',
        '',
        '',
        ''
      );
    } else if (cmd.kind === 'primitive') {
      const wb = cmd.worldBounds ?? [0, 1, 0, 1];
      const mapX = (wx: number) => box.x + ((wx - wb[0]) / Math.max(1e-9, wb[1] - wb[0])) * box.w;
      const mapY = (wy: number) => box.y + (1 - (wy - wb[2]) / Math.max(1e-9, wb[3] - wb[2])) * box.h;

      ctx.save();
      ctx.strokeStyle = strokeHex;
      ctx.fillStyle = strokeHex;
      ctx.lineWidth = strokeW;
      ctx.setLineDash(dash);

      const c = cmd.coords ?? [0, 0, 1, 1];
      if (cmd.shape === 'innerBox') {
        ctx.strokeRect(box.x, box.y, box.w, box.h);
      } else if (cmd.shape === 'line' || cmd.shape === 'arrow') {
        const x1p = mapX(c[0]);
        const y1p = mapY(c[1]);
        const x2p = mapX(c[2]);
        const y2p = mapY(c[3]);
        ctx.beginPath();
        ctx.moveTo(x1p, y1p);
        ctx.lineTo(x2p, y2p);
        ctx.stroke();
        if (cmd.shape === 'arrow') {
          const angle = Math.atan2(y2p - y1p, x2p - x1p);
          const head = 7 * pt;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(x2p, y2p);
          ctx.lineTo(x2p - head * Math.cos(angle - Math.PI / 6), y2p - head * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(x2p - head * Math.cos(angle + Math.PI / 6), y2p - head * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();
        }
      } else if (cmd.shape === 'rectangle' || cmd.shape === 'paintRectangle') {
        const rx1 = mapX(c[0]);
        const rx2 = mapX(c[1]);
        const ry1 = mapY(c[3]);
        const ry2 = mapY(c[2]);
        if (cmd.shape === 'paintRectangle') {
          ctx.fillRect(Math.min(rx1, rx2), Math.min(ry1, ry2), Math.abs(rx2 - rx1), Math.abs(ry2 - ry1));
        } else {
          ctx.strokeRect(Math.min(rx1, rx2), Math.min(ry1, ry2), Math.abs(rx2 - rx1), Math.abs(ry2 - ry1));
        }
      } else if (cmd.shape === 'circle' || cmd.shape === 'paintCircle') {
        const cx = mapX(c[0]);
        const cy = mapY(c[1]);
        const rx = Math.abs(mapX(c[0] + c[2]) - cx);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, rx), 0, Math.PI * 2);
        if (cmd.shape === 'paintCircle') ctx.fill();
        else ctx.stroke();
      } else if (cmd.shape === 'textTop' && cmd.text) {
        const fontPx = Math.max(10, Math.round(cmd.pen.fontSize * 0.95 * pt));
        ctx.font = `600 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(cmd.text, box.x + box.w / 2, box.y - 4 * pt);
      } else if (cmd.shape === 'text' && cmd.text) {
        const fontPx = Math.max(9, Math.round(cmd.pen.fontSize * 0.85 * pt));
        ctx.font = `${fontPx}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cmd.text, mapX(c[0]), mapY(c[1]));
      }
      ctx.restore();
    }
  }

  // Highlight active Praat Picture outer viewport (pink/rose frame like desktop Praat!)
  if (selectedViewport) {
    const vx = Math.min(selectedViewport.x1, selectedViewport.x2) * scalePerInch;
    const vy = Math.min(selectedViewport.y1, selectedViewport.y2) * scalePerInch;
    const vw = Math.abs(selectedViewport.x2 - selectedViewport.x1) * scalePerInch;
    const vh = Math.abs(selectedViewport.y2 - selectedViewport.y1) * scalePerInch;

    ctx.strokeStyle = 'rgba(225, 29, 72, 0.65)';
    ctx.fillStyle = 'rgba(244, 63, 94, 0.04)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.fillRect(vx, vy, vw, vh);
    ctx.strokeRect(vx, vy, vw, vh);
  }

  ctx.restore();
}

function renderSvgGarnish(
  box: InnerBoxRect,
  pen: PicturePenSettings,
  title: string,
  xMinLabel: string,
  xMaxLabel: string,
  xUnitLabel: string,
  yMinLabel: string,
  yMaxLabel: string,
  yUnitLabel: string
): string {
  if (!pen.garnish) return '';
  const fontSize = Math.max(8, Math.round(pen.fontSize * 0.85));
  const tick = 4;
  const parts: string[] = [];

  parts.push(
    `<rect x="${box.x.toFixed(2)}" y="${box.y.toFixed(2)}" width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" fill="none" stroke="#0f172a" stroke-width="1"/>`
  );
  parts.push(
    `<line x1="${box.x.toFixed(2)}" y1="${(box.y + box.h).toFixed(2)}" x2="${box.x.toFixed(2)}" y2="${(box.y + box.h + tick).toFixed(2)}" stroke="#0f172a" stroke-width="1"/>`,
    `<line x1="${(box.x + box.w).toFixed(2)}" y1="${(box.y + box.h).toFixed(2)}" x2="${(box.x + box.w).toFixed(2)}" y2="${(box.y + box.h + tick).toFixed(2)}" stroke="#0f172a" stroke-width="1"/>`,
    `<text x="${box.x.toFixed(2)}" y="${(box.y + box.h + tick + fontSize).toFixed(2)}" font-family="sans-serif" font-size="${fontSize}" text-anchor="start" fill="#0f172a">${escapeXml(xMinLabel)}</text>`,
    `<text x="${(box.x + box.w).toFixed(2)}" y="${(box.y + box.h + tick + fontSize).toFixed(2)}" font-family="sans-serif" font-size="${fontSize}" text-anchor="end" fill="#0f172a">${escapeXml(xMaxLabel)}</text>`,
    `<text x="${(box.x + box.w / 2).toFixed(2)}" y="${(box.y + box.h + tick + fontSize * 2).toFixed(2)}" font-family="sans-serif" font-size="${fontSize}" text-anchor="middle" fill="#0f172a">${escapeXml(xUnitLabel)}</text>`
  );

  if (yMaxLabel || yMinLabel) {
    parts.push(
      `<line x1="${(box.x - tick).toFixed(2)}" y1="${box.y.toFixed(2)}" x2="${box.x.toFixed(2)}" y2="${box.y.toFixed(2)}" stroke="#0f172a" stroke-width="1"/>`,
      `<line x1="${(box.x - tick).toFixed(2)}" y1="${(box.y + box.h).toFixed(2)}" x2="${box.x.toFixed(2)}" y2="${(box.y + box.h).toFixed(2)}" stroke="#0f172a" stroke-width="1"/>`,
      `<text x="${(box.x - tick - 3).toFixed(2)}" y="${(box.y + fontSize * 0.8).toFixed(2)}" font-family="sans-serif" font-size="${fontSize}" text-anchor="end" fill="#0f172a">${escapeXml(yMaxLabel)}</text>`,
      `<text x="${(box.x - tick - 3).toFixed(2)}" y="${(box.y + box.h).toFixed(2)}" font-family="sans-serif" font-size="${fontSize}" text-anchor="end" fill="#0f172a">${escapeXml(yMinLabel)}</text>`
    );
  }

  if (yUnitLabel) {
    const cx = box.x - tick - fontSize * 2.2;
    const cy = box.y + box.h / 2;
    parts.push(
      `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" font-family="sans-serif" font-size="${fontSize}" text-anchor="middle" fill="#0f172a" transform="rotate(-90 ${cx.toFixed(2)} ${cy.toFixed(2)})">${escapeXml(yUnitLabel)}</text>`
    );
  }

  if (title) {
    parts.push(
      `<text x="${(box.x + box.w / 2).toFixed(2)}" y="${(box.y - 5).toFixed(2)}" font-family="sans-serif" font-size="${Math.round(fontSize * 1.05)}" font-weight="600" text-anchor="middle" fill="#0f172a">${escapeXml(title)}</text>`
    );
  }

  return parts.join('\n');
}

/**
 * Exports the Praat Picture scene graph to a standalone publication-grade SVG string.
 */
export function renderPictureToSvg(commands: PictureCommand[]): string {
  const totalPt = PAGE_INCHES * SVG_POINTS_PER_INCH; // 864 x 864
  const elements: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalPt}" height="${totalPt}" viewBox="0 0 ${totalPt} ${totalPt}">`,
    `<rect width="${totalPt}" height="${totalPt}" fill="#ffffff"/>`,
  ];

  commands.forEach((cmd, cmdIdx) => {
    const box = computeInnerBox(cmd.viewport, SVG_POINTS_PER_INCH, cmd.pen.garnish);
    const strokeHex = PRAAT_COLOUR_HEX[cmd.pen.colour] ?? '#000000';
    const dashArr = getLineDashPattern(cmd.pen.lineType, 1);
    const dashAttr = dashArr.length > 0 ? ` stroke-dasharray="${dashArr.join(',')}"` : '';
    const strokeW = Math.max(0.75, cmd.pen.lineWidth);
    const clipId = `clip_vp_${cmdIdx}`;

    elements.push(
      `<defs><clipPath id="${clipId}"><rect x="${box.x.toFixed(2)}" y="${box.y.toFixed(2)}" width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}"/></clipPath></defs>`
    );

    if (cmd.kind === 'waveform') {
      const { samples, tmin, tmax } = cmd;
      let { minAmp, maxAmp } = cmd;
      if (minAmp === 0 && maxAmp === 0) {
        let peak = 1e-4;
        for (let i = 0; i < samples.length; i++) {
          const a = Math.abs(samples[i]);
          if (a > peak) peak = a;
        }
        minAmp = -peak;
        maxAmp = peak;
      }

      if (samples.length > 0) {
        const step = Math.max(1, Math.floor(samples.length / 1200));
        const dParts: string[] = [];
        for (let i = 0; i < samples.length; i += step) {
          const x = box.x + (i / Math.max(1, samples.length - 1)) * box.w;
          const y = box.y + ((maxAmp - samples[i]) / Math.max(1e-9, maxAmp - minAmp)) * box.h;
          dParts.push(`${dParts.length === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
        }
        elements.push(
          `<path d="${dParts.join(' ')}" fill="none" stroke="${strokeHex}" stroke-width="${strokeW}"${dashAttr} clip-path="url(#${clipId})"/>`
        );
      }

      elements.push(
        renderSvgGarnish(
          box,
          cmd.pen,
          cmd.title,
          formatAxisNumber(tmin),
          formatAxisNumber(tmax),
          'Time (s)',
          formatAxisNumber(minAmp),
          formatAxisNumber(maxAmp),
          'Amplitude'
        )
      );
    } else if (cmd.kind === 'spectrogram') {
      const imgW = Math.max(16, Math.min(360, Math.round(box.w)));
      const imgH = Math.max(16, Math.min(240, Math.round(box.h)));
      const rgba = buildSpectrogramRgba(cmd, imgW, imgH);
      const dataUri = encodeRgbaToBmpDataUri(rgba, imgW, imgH);
      elements.push(
        `<image x="${box.x.toFixed(2)}" y="${box.y.toFixed(2)}" width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" preserveAspectRatio="none" href="${dataUri}" clip-path="url(#${clipId})"/>`,
        renderSvgGarnish(
          box,
          cmd.pen,
          cmd.title,
          formatAxisNumber(cmd.tmin),
          formatAxisNumber(cmd.tmax),
          'Time (s)',
          '0',
          formatAxisNumber(cmd.maxFreq),
          'Frequency (Hz)'
        )
      );
    } else if (cmd.kind === 'pitch') {
      const { frequencies, x1, dx, tmin, tmax, fmin, fmax } = cmd;
      const dur = Math.max(1e-6, tmax - tmin);
      const fSpan = Math.max(1, fmax - fmin);
      const dParts: string[] = [];
      let inSeg = false;
      for (let i = 0; i < frequencies.length; i++) {
        const f = frequencies[i];
        const t = x1 + i * dx;
        if (f > 0 && f >= fmin && f <= fmax && t >= tmin && t <= tmax) {
          const x = box.x + ((t - tmin) / dur) * box.w;
          const y = box.y + (1 - (f - fmin) / fSpan) * box.h;
          dParts.push(`${!inSeg ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
          inSeg = true;
        } else {
          inSeg = false;
        }
      }
      if (dParts.length > 0) {
        elements.push(
          `<path d="${dParts.join(' ')}" fill="none" stroke="${strokeHex}" stroke-width="${Math.max(1.25, strokeW)}"${dashAttr} clip-path="url(#${clipId})"/>`
        );
      }
      elements.push(
        renderSvgGarnish(
          box,
          cmd.pen,
          cmd.title,
          formatAxisNumber(tmin),
          formatAxisNumber(tmax),
          'Time (s)',
          formatAxisNumber(fmin),
          formatAxisNumber(fmax),
          'Pitch (Hz)'
        )
      );
    } else if (cmd.kind === 'formants') {
      const { frequencies, x1, dx, maxnFormants, tmin, tmax, maxFreq, speckle } = cmd;
      const dur = Math.max(1e-6, tmax - tmin);
      const nFrames = maxnFormants > 0 ? Math.floor(frequencies.length / maxnFormants) : 0;

      if (speckle) {
        const circles: string[] = [`<g fill="${strokeHex}" clip-path="url(#${clipId})">`];
        for (let i = 0; i < nFrames; i++) {
          const t = x1 + i * dx;
          if (t < tmin || t > tmax) continue;
          const x = box.x + ((t - tmin) / dur) * box.w;
          for (let fIdx = 0; fIdx < maxnFormants; fIdx++) {
            const freq = frequencies[i * maxnFormants + fIdx];
            if (freq > 0 && freq <= maxFreq) {
              const y = box.y + (1 - freq / maxFreq) * box.h;
              circles.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.6"/>`);
            }
          }
        }
        circles.push('</g>');
        elements.push(circles.join(''));
      } else {
        for (let fIdx = 0; fIdx < maxnFormants; fIdx++) {
          const dParts: string[] = [];
          let open = false;
          for (let i = 0; i < nFrames; i++) {
            const t = x1 + i * dx;
            const freq = frequencies[i * maxnFormants + fIdx];
            if (t >= tmin && t <= tmax && freq > 0 && freq <= maxFreq) {
              const x = box.x + ((t - tmin) / dur) * box.w;
              const y = box.y + (1 - freq / maxFreq) * box.h;
              dParts.push(`${!open ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
              open = true;
            } else {
              open = false;
            }
          }
          if (dParts.length > 0) {
            elements.push(
              `<path d="${dParts.join(' ')}" fill="none" stroke="${strokeHex}" stroke-width="${strokeW}"${dashAttr} clip-path="url(#${clipId})"/>`
            );
          }
        }
      }
      elements.push(
        renderSvgGarnish(
          box,
          cmd.pen,
          cmd.title,
          formatAxisNumber(tmin),
          formatAxisNumber(tmax),
          'Time (s)',
          '0',
          formatAxisNumber(maxFreq),
          'Formant (Hz)'
        )
      );
    } else if (cmd.kind === 'intensity' || cmd.kind === 'cpp') {
      const { values, x1, dx, tmin, tmax } = cmd;
      let { minDb, maxDb } = cmd;
      if (minDb === 0 && maxDb === 0 && values.length > 0) {
        minDb = Infinity;
        maxDb = -Infinity;
        for (let i = 0; i < values.length; i++) {
          const v = values[i];
          if (Number.isFinite(v)) {
            if (v < minDb) minDb = v;
            if (v > maxDb) maxDb = v;
          }
        }
        if (!Number.isFinite(minDb) || minDb === maxDb) {
          minDb = 0;
          maxDb = 100;
        } else {
          const pad = (maxDb - minDb) * 0.1 || 5;
          minDb -= pad;
          maxDb += pad;
        }
      }
      const dur = Math.max(1e-6, tmax - tmin);
      const dbSpan = Math.max(1e-6, maxDb - minDb);
      const dParts: string[] = [];
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        const t = x1 + i * dx;
        if (Number.isFinite(v) && t >= tmin && t <= tmax) {
          const x = box.x + ((t - tmin) / dur) * box.w;
          const y = box.y + (1 - (v - minDb) / dbSpan) * box.h;
          dParts.push(`${dParts.length === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
        }
      }
      if (dParts.length > 0) {
        elements.push(
          `<path d="${dParts.join(' ')}" fill="none" stroke="${strokeHex}" stroke-width="${Math.max(1.2, strokeW)}"${dashAttr} clip-path="url(#${clipId})"/>`
        );
      }
      elements.push(
        renderSvgGarnish(
          box,
          cmd.pen,
          cmd.title,
          formatAxisNumber(tmin),
          formatAxisNumber(tmax),
          'Time (s)',
          formatAxisNumber(minDb),
          formatAxisNumber(maxDb),
          cmd.kind === 'cpp' ? 'CPP (dB)' : 'Intensity (dB)'
        )
      );
    } else if (cmd.kind === 'textgrid') {
      const { data, tmin, tmax } = cmd;
      const tiers = data.tiers;
      const dur = Math.max(1e-6, tmax - tmin);
      const nTiers = Math.max(1, tiers.length);
      const tierH = box.h / nTiers;
      const fontSize = Math.max(8, Math.round(cmd.pen.fontSize * 0.85));

      tiers.forEach((tier, idx) => {
        const yTop = box.y + idx * tierH;
        if (idx > 0) {
          elements.push(
            `<line x1="${box.x.toFixed(2)}" y1="${yTop.toFixed(2)}" x2="${(box.x + box.w).toFixed(2)}" y2="${yTop.toFixed(2)}" stroke="${strokeHex}" stroke-width="${strokeW}"/>`
          );
        }
        if (tier.type === 'IntervalTier') {
          for (const iv of tier.intervals) {
            if (iv.xmax < tmin || iv.xmin > tmax) continue;
            const xLeft = box.x + ((Math.max(tmin, iv.xmin) - tmin) / dur) * box.w;
            const xRight = box.x + ((Math.min(tmax, iv.xmax) - tmin) / dur) * box.w;
            if (iv.xmin > tmin) {
              elements.push(
                `<line x1="${xLeft.toFixed(2)}" y1="${yTop.toFixed(2)}" x2="${xLeft.toFixed(2)}" y2="${(yTop + tierH).toFixed(2)}" stroke="#1d4ed8" stroke-width="1"/>`
              );
            }
            if (iv.text) {
              elements.push(
                `<text x="${((xLeft + xRight) / 2).toFixed(2)}" y="${(yTop + tierH * 0.6).toFixed(2)}" font-family="sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${strokeHex}">${escapeXml(iv.text)}</text>`
              );
            }
          }
        } else {
          for (const ptItem of tier.points) {
            if (ptItem.time < tmin || ptItem.time > tmax) continue;
            const xPos = box.x + ((ptItem.time - tmin) / dur) * box.w;
            elements.push(
              `<line x1="${xPos.toFixed(2)}" y1="${yTop.toFixed(2)}" x2="${xPos.toFixed(2)}" y2="${(yTop + tierH).toFixed(2)}" stroke="#1d4ed8" stroke-dasharray="2,2" stroke-width="1"/>`
            );
            if (ptItem.mark) {
              elements.push(
                `<text x="${xPos.toFixed(2)}" y="${(yTop + tierH * 0.6).toFixed(2)}" font-family="sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${strokeHex}">${escapeXml(ptItem.mark)}</text>`
              );
            }
          }
        }
      });

      elements.push(
        renderSvgGarnish(
          box,
          cmd.pen,
          cmd.title,
          formatAxisNumber(tmin),
          formatAxisNumber(tmax),
          'Time (s)',
          '',
          '',
          ''
        )
      );
    } else if (cmd.kind === 'primitive') {
      const wb = cmd.worldBounds ?? [0, 1, 0, 1];
      const mapX = (wx: number) => box.x + ((wx - wb[0]) / Math.max(1e-9, wb[1] - wb[0])) * box.w;
      const mapY = (wy: number) => box.y + (1 - (wy - wb[2]) / Math.max(1e-9, wb[3] - wb[2])) * box.h;
      const c = cmd.coords ?? [0, 0, 1, 1];

      if (cmd.shape === 'innerBox') {
        elements.push(
          `<rect x="${box.x.toFixed(2)}" y="${box.y.toFixed(2)}" width="${box.w.toFixed(2)}" height="${box.h.toFixed(2)}" fill="none" stroke="${strokeHex}" stroke-width="${strokeW}"${dashAttr}/>`
        );
      } else if (cmd.shape === 'line' || cmd.shape === 'arrow') {
        elements.push(
          `<line x1="${mapX(c[0]).toFixed(2)}" y1="${mapY(c[1]).toFixed(2)}" x2="${mapX(c[2]).toFixed(2)}" y2="${mapY(c[3]).toFixed(2)}" stroke="${strokeHex}" stroke-width="${strokeW}"${dashAttr}/>`
        );
      } else if (cmd.shape === 'rectangle' || cmd.shape === 'paintRectangle') {
        const rx1 = mapX(c[0]);
        const rx2 = mapX(c[1]);
        const ry1 = mapY(c[3]);
        const ry2 = mapY(c[2]);
        elements.push(
          `<rect x="${Math.min(rx1, rx2).toFixed(2)}" y="${Math.min(ry1, ry2).toFixed(2)}" width="${Math.abs(rx2 - rx1).toFixed(2)}" height="${Math.abs(ry2 - ry1).toFixed(2)}" fill="${cmd.shape === 'paintRectangle' ? strokeHex : 'none'}" stroke="${cmd.shape === 'paintRectangle' ? 'none' : strokeHex}" stroke-width="${strokeW}"${dashAttr}/>`
        );
      } else if (cmd.shape === 'circle' || cmd.shape === 'paintCircle') {
        const cx = mapX(c[0]);
        const cy = mapY(c[1]);
        const rx = Math.abs(mapX(c[0] + c[2]) - cx);
        elements.push(
          `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${Math.max(1, rx).toFixed(2)}" fill="${cmd.shape === 'paintCircle' ? strokeHex : 'none'}" stroke="${cmd.shape === 'paintCircle' ? 'none' : strokeHex}" stroke-width="${strokeW}"/>`
        );
      } else if (cmd.shape === 'textTop' && cmd.text) {
        const fontSize = Math.max(10, Math.round(cmd.pen.fontSize * 0.95));
        elements.push(
          `<text x="${(box.x + box.w / 2).toFixed(2)}" y="${(box.y - 5).toFixed(2)}" font-family="sans-serif" font-size="${fontSize}" font-weight="600" text-anchor="middle" fill="${strokeHex}">${escapeXml(cmd.text)}</text>`
        );
      } else if (cmd.shape === 'text' && cmd.text) {
        const fontSize = Math.max(9, Math.round(cmd.pen.fontSize * 0.85));
        elements.push(
          `<text x="${mapX(c[0]).toFixed(2)}" y="${mapY(c[1]).toFixed(2)}" font-family="sans-serif" font-size="${fontSize}" text-anchor="middle" fill="${strokeHex}">${escapeXml(cmd.text)}</text>`
        );
      }
    }
  });

  elements.push('</svg>');
  return elements.join('\n');
}

/**
 * Renders the Praat Picture scene graph to a high-DPI PNG Blob.
 */
export async function exportPictureToPngBlob(
  commands: PictureCommand[],
  dpi = 150
): Promise<Blob> {
  const px = PAGE_INCHES * dpi;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  renderPictureToCanvas(ctx, px, px, commands, undefined, false);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode Picture canvas as PNG'));
    }, 'image/png');
  });
}

function resolvePraatColourName(raw: string): PraatColour | null {
  const cleaned = raw.trim().replace(/^["']|["']$/g, '').toLowerCase();
  for (const col of PRAAT_COLOURS_LIST) {
    if (col.toLowerCase() === cleaned) return col;
  }
  return null;
}

export interface ParsedPictureScriptResult {
  hasPictureCommands: boolean;
  eraseAll: boolean;
  commands: PictureCommand[];
  finalViewport: PictureViewport;
  finalPen: PicturePenSettings;
  remainingDspScript: string;
}

/**
 * Parses Praat Picture drawing directives in a Praat script (e.g., `Erase all`,
 * `Select outer viewport:`, `Colour:`, `Line width:`, `Draw inner box`, `Draw line:`,
 * `Paint rectangle:`, `Draw circle:`, `Text top:`, `Text:`), returning structured
 * `PictureCommand` items plus any non-Picture lines for WASM script execution.
 */
export function parsePraatPictureScriptCommands(
  scriptText: string,
  initialViewport: PictureViewport,
  initialPen: PicturePenSettings
): ParsedPictureScriptResult {
  let viewport: PictureViewport = { ...initialViewport };
  let pen: PicturePenSettings = { ...initialPen };
  let worldBounds: [number, number, number, number] = [0, 1, 0, 1];
  let eraseAll = false;
  let hasPictureCommands = false;
  const commands: PictureCommand[] = [];
  const dspLines: string[] = [];

  const splitArgs = (argStr: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < argStr.length; i++) {
      const ch = argStr[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        cur += ch;
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  const unquote = (s: string) => s.trim().replace(/^"(.*)"$/, '$1');

  const lines = scriptText.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) {
      dspLines.push(rawLine);
      continue;
    }

    if (/^Erase all$/i.test(line)) {
      hasPictureCommands = true;
      eraseAll = true;
      commands.length = 0;
      continue;
    }

    if (/^Solid line$/i.test(line)) {
      hasPictureCommands = true;
      pen = { ...pen, lineType: 'solid' };
      continue;
    }
    if (/^Dotted line$/i.test(line)) {
      hasPictureCommands = true;
      pen = { ...pen, lineType: 'dotted' };
      continue;
    }
    if (/^Dashed line$/i.test(line)) {
      hasPictureCommands = true;
      pen = { ...pen, lineType: 'dashed' };
      continue;
    }
    if (/^Dash-dotted line$/i.test(line)) {
      hasPictureCommands = true;
      pen = { ...pen, lineType: 'dash-dotted' };
      continue;
    }

    const bareCol = resolvePraatColourName(line);
    if (bareCol) {
      hasPictureCommands = true;
      pen = { ...pen, colour: bareCol };
      continue;
    }

    if (/^Draw inner box$/i.test(line)) {
      hasPictureCommands = true;
      commands.push({
        id: `pic_script_${commands.length}_${Date.now()}`,
        kind: 'primitive',
        viewport: { ...viewport },
        pen: { ...pen },
        shape: 'innerBox',
        worldBounds: [...worldBounds],
      });
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const cmdName = line.slice(0, colonIdx).trim();
      const args = splitArgs(line.slice(colonIdx + 1));

      if (/^Select (outer|inner) viewport$/i.test(cmdName) && args.length >= 4) {
        hasPictureCommands = true;
        viewport = {
          x1: Number(args[0]) || 0,
          x2: Number(args[1]) || 6,
          y1: Number(args[2]) || 0,
          y2: Number(args[3]) || 4,
        };
        continue;
      }

      if (/^Axes$/i.test(cmdName) && args.length >= 4) {
        hasPictureCommands = true;
        worldBounds = [
          Number(args[0]) || 0,
          Number(args[1]) || 1,
          Number(args[2]) || 0,
          Number(args[3]) || 1,
        ];
        continue;
      }

      if (/^Colour$/i.test(cmdName) && args.length >= 1) {
        const col = resolvePraatColourName(args[0]);
        if (col) {
          hasPictureCommands = true;
          pen = { ...pen, colour: col };
          continue;
        }
      }

      if (/^Line width$/i.test(cmdName) && args.length >= 1) {
        hasPictureCommands = true;
        pen = { ...pen, lineWidth: Math.max(0.5, Number(args[0]) || 1) };
        continue;
      }

      if (/^Font size$/i.test(cmdName) && args.length >= 1) {
        hasPictureCommands = true;
        pen = { ...pen, fontSize: Math.max(6, Number(args[0]) || 12) };
        continue;
      }

      if (/^Draw (line|arrow)$/i.test(cmdName) && args.length >= 4) {
        hasPictureCommands = true;
        const isArrow = /arrow/i.test(cmdName);
        commands.push({
          id: `pic_script_${commands.length}_${Date.now()}`,
          kind: 'primitive',
          viewport: { ...viewport },
          pen: { ...pen },
          shape: isArrow ? 'arrow' : 'line',
          coords: [Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3])],
          worldBounds: [...worldBounds],
        });
        continue;
      }

      if (/^Draw rectangle$/i.test(cmdName) && args.length >= 4) {
        hasPictureCommands = true;
        commands.push({
          id: `pic_script_${commands.length}_${Date.now()}`,
          kind: 'primitive',
          viewport: { ...viewport },
          pen: { ...pen },
          shape: 'rectangle',
          coords: [Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3])],
          worldBounds: [...worldBounds],
        });
        continue;
      }

      if (/^Paint rectangle$/i.test(cmdName) && args.length >= 5) {
        hasPictureCommands = true;
        const fillCol = resolvePraatColourName(args[0]) ?? pen.colour;
        commands.push({
          id: `pic_script_${commands.length}_${Date.now()}`,
          kind: 'primitive',
          viewport: { ...viewport },
          pen: { ...pen, colour: fillCol },
          shape: 'paintRectangle',
          coords: [Number(args[1]), Number(args[2]), Number(args[3]), Number(args[4])],
          worldBounds: [...worldBounds],
        });
        continue;
      }

      if (/^Draw circle$/i.test(cmdName) && args.length >= 3) {
        hasPictureCommands = true;
        commands.push({
          id: `pic_script_${commands.length}_${Date.now()}`,
          kind: 'primitive',
          viewport: { ...viewport },
          pen: { ...pen },
          shape: 'circle',
          coords: [Number(args[0]), Number(args[1]), Number(args[2]), 0],
          worldBounds: [...worldBounds],
        });
        continue;
      }

      if (/^Paint circle$/i.test(cmdName) && args.length >= 4) {
        hasPictureCommands = true;
        const fillCol = resolvePraatColourName(args[0]) ?? pen.colour;
        commands.push({
          id: `pic_script_${commands.length}_${Date.now()}`,
          kind: 'primitive',
          viewport: { ...viewport },
          pen: { ...pen, colour: fillCol },
          shape: 'paintCircle',
          coords: [Number(args[1]), Number(args[2]), Number(args[3]), 0],
          worldBounds: [...worldBounds],
        });
        continue;
      }

      if (/^Text top$/i.test(cmdName) && args.length >= 1) {
        hasPictureCommands = true;
        const label = unquote(args[args.length - 1]);
        commands.push({
          id: `pic_script_${commands.length}_${Date.now()}`,
          kind: 'primitive',
          viewport: { ...viewport },
          pen: { ...pen },
          shape: 'textTop',
          text: label,
          worldBounds: [...worldBounds],
        });
        continue;
      }

      if (/^Text$/i.test(cmdName) && args.length >= 5) {
        hasPictureCommands = true;
        commands.push({
          id: `pic_script_${commands.length}_${Date.now()}`,
          kind: 'primitive',
          viewport: { ...viewport },
          pen: { ...pen },
          shape: 'text',
          coords: [Number(args[0]) || 0, Number(args[2]) || 0, 0, 0],
          text: unquote(args[4]),
          worldBounds: [...worldBounds],
        });
        continue;
      }
    }

    dspLines.push(rawLine);
  }

  return {
    hasPictureCommands,
    eraseAll,
    commands,
    finalViewport: viewport,
    finalPen: pen,
    remainingDspScript: dspLines.join('\n'),
  };
}
