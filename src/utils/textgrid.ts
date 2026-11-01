/**
 * TextGrid Parser, Serializer, and Manipulation Utilities.
 * Fully compatible with desktop Praat's ooTextFile format.
 */

import type {
  TextGridData,
  TextGridTier,
  IntervalTier,
  PointTier,
  TextInterval,
  TextPoint,
} from '../types/praat';

export function isIntervalTier(tier: TextGridTier): tier is IntervalTier {
  return tier.type === 'IntervalTier';
}

export function isPointTier(tier: TextGridTier): tier is PointTier {
  return tier.type === 'TextTier';
}

/**
 * Creates a blank TextGridData structure.
 */
export function createNewTextGrid(
  tmin: number,
  tmax: number,
  tierNames: string[] = ['sentence'],
  pointTierNames: string[] = []
): TextGridData {
  const tiers: TextGridTier[] = [];

  for (const name of tierNames) {
    if (!name.trim()) continue;
    const isPoint = pointTierNames.includes(name.trim());
    if (isPoint) {
      tiers.push({
        type: 'TextTier',
        name: name.trim(),
        xmin: tmin,
        xmax: tmax,
        points: [],
      });
    } else {
      tiers.push({
        type: 'IntervalTier',
        name: name.trim(),
        xmin: tmin,
        xmax: tmax,
        intervals: [
          {
            id: `int_${Date.now()}_0`,
            xmin: tmin,
            xmax: tmax,
            text: '',
          },
        ],
      });
    }
  }

  return {
    xmin: tmin,
    xmax: tmax,
    tiers,
  };
}

/**
 * Serializes TextGridData into standard Praat ooTextFile format.
 */
export function serializeTextGrid(data: TextGridData): string {
  const lines: string[] = [
    'File type = "ooTextFile"',
    'Object class = "TextGrid"',
    '',
    `xmin = ${data.xmin} `,
    `xmax = ${data.xmax} `,
    'tiers? <exists> ',
    `size = ${data.tiers.length} `,
    'item []: ',
  ];

  data.tiers.forEach((tier, tIdx) => {
    lines.push(`    item [${tIdx + 1}]:`);
    lines.push(`        class = "${tier.type}" `);
    lines.push(`        name = "${tier.name.replace(/"/g, '""')}" `);
    lines.push(`        xmin = ${tier.xmin} `);
    lines.push(`        xmax = ${tier.xmax} `);

    if (tier.type === 'IntervalTier') {
      lines.push(`        intervals: size = ${tier.intervals.length} `);
      tier.intervals.forEach((interval, iIdx) => {
        lines.push(`        intervals [${iIdx + 1}]:`);
        lines.push(`            xmin = ${interval.xmin} `);
        lines.push(`            xmax = ${interval.xmax} `);
        lines.push(`            text = "${interval.text.replace(/"/g, '""')}" `);
      });
    } else {
      lines.push(`        points: size = ${tier.points.length} `);
      tier.points.forEach((point, pIdx) => {
        lines.push(`        points [${pIdx + 1}]:`);
        lines.push(`            number = ${point.time} `);
        lines.push(`            mark = "${point.mark.replace(/"/g, '""')}" `);
      });
    }
  });

  return lines.join('\n') + '\n';
}

/**
 * Parses Praat TextGrid file (supports both long format and short format).
 */
export function parseTextGrid(content: string): TextGridData {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Empty TextGrid content');
  }

  // Tokenize content handling quoted strings
  const tokens: string[] = [];
  let i = 0;
  const n = trimmed.length;

  while (i < n) {
    const ch = trimmed[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '"') {
      i++;
      let str = '';
      while (i < n) {
        if (trimmed[i] === '"') {
          if (i + 1 < n && trimmed[i + 1] === '"') {
            str += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          str += trimmed[i];
          i++;
        }
      }
      tokens.push(str);
      continue;
    }

    let token = '';
    while (i < n && !/\s/.test(trimmed[i]) && trimmed[i] !== '"') {
      token += trimmed[i];
      i++;
    }
    if (token) {
      tokens.push(token);
    }
  }

  // Skip header tokens through 'TextGrid'
  let tIdx = 0;
  const gridHeaderIdx = tokens.lastIndexOf('TextGrid');
  if (gridHeaderIdx !== -1 && gridHeaderIdx < 15) {
    tIdx = gridHeaderIdx + 1;
  }

  // Check if this is long format or short format
  const isLongFormat = tokens.some((tok) => tok === 'xmin' || tok === 'item');

  if (isLongFormat) {
    return parseLongFormatTokens(tokens, tIdx);
  } else {
    return parseShortFormatTokens(tokens, tIdx);
  }
}

function parseLongFormatTokens(tokens: string[], startIndex: number): TextGridData {
  let idx = startIndex;

  function findNextValueAfter(keyword: string): string {
    while (idx < tokens.length) {
      if (tokens[idx] === keyword) {
        idx++;
        if (idx < tokens.length && tokens[idx] === '=') idx++;
        if (idx < tokens.length) {
          const val = tokens[idx];
          idx++;
          return val;
        }
      }
      idx++;
    }
    return '';
  }

  const xmin = parseFloat(findNextValueAfter('xmin')) || 0.0;
  const xmax = parseFloat(findNextValueAfter('xmax')) || 0.0;
  const nTiers = parseInt(findNextValueAfter('size'), 10) || 0;

  const tiers: TextGridTier[] = [];

  for (let t = 0; t < nTiers; ++t) {
    const tierClass = findNextValueAfter('class');
    const tierName = findNextValueAfter('name');
    const tierXmin = parseFloat(findNextValueAfter('xmin')) || xmin;
    const tierXmax = parseFloat(findNextValueAfter('xmax')) || xmax;
    const count = parseInt(findNextValueAfter('size'), 10) || 0;

    if (tierClass.includes('IntervalTier')) {
      const intervals: TextInterval[] = [];
      for (let j = 0; j < count; ++j) {
        const iXmin = parseFloat(findNextValueAfter('xmin'));
        const iXmax = parseFloat(findNextValueAfter('xmax'));
        const text = findNextValueAfter('text');
        intervals.push({
          id: `int_${t}_${j}`,
          xmin: iXmin,
          xmax: iXmax,
          text,
        });
      }
      tiers.push({
        type: 'IntervalTier',
        name: tierName,
        xmin: tierXmin,
        xmax: tierXmax,
        intervals,
      });
    } else {
      const points: TextPoint[] = [];
      for (let j = 0; j < count; ++j) {
        const time = parseFloat(findNextValueAfter('number'));
        const mark = findNextValueAfter('mark');
        points.push({
          id: `pt_${t}_${j}`,
          time,
          mark,
        });
      }
      tiers.push({
        type: 'TextTier',
        name: tierName,
        xmin: tierXmin,
        xmax: tierXmax,
        points,
      });
    }
  }

  return {
    xmin,
    xmax,
    tiers,
  };
}

function parseShortFormatTokens(tokens: string[], startIndex: number): TextGridData {
  let idx = startIndex;
  const xmin = parseFloat(tokens[idx++]) || 0.0;
  const xmax = parseFloat(tokens[idx++]) || 0.0;
  if (tokens[idx] === '<exists>') idx++;
  const nTiers = parseInt(tokens[idx++], 10) || 0;

  const tiers: TextGridTier[] = [];

  for (let t = 0; t < nTiers; ++t) {
    const tierClass = tokens[idx++];
    const tierName = tokens[idx++];
    const tierXmin = parseFloat(tokens[idx++]) || xmin;
    const tierXmax = parseFloat(tokens[idx++]) || xmax;
    const count = parseInt(tokens[idx++], 10) || 0;

    if (tierClass.includes('IntervalTier')) {
      const intervals: TextInterval[] = [];
      for (let j = 0; j < count; ++j) {
        const iXmin = parseFloat(tokens[idx++]);
        const iXmax = parseFloat(tokens[idx++]);
        const text = tokens[idx++];
        intervals.push({
          id: `int_${t}_${j}`,
          xmin: iXmin,
          xmax: iXmax,
          text,
        });
      }
      tiers.push({
        type: 'IntervalTier',
        name: tierName,
        xmin: tierXmin,
        xmax: tierXmax,
        intervals,
      });
    } else {
      const points: TextPoint[] = [];
      for (let j = 0; j < count; ++j) {
        const time = parseFloat(tokens[idx++]);
        const mark = tokens[idx++];
        points.push({
          id: `pt_${t}_${j}`,
          time,
          mark,
        });
      }
      tiers.push({
        type: 'TextTier',
        name: tierName,
        xmin: tierXmin,
        xmax: tierXmax,
        points,
      });
    }
  }

  return {
    xmin,
    xmax,
    tiers,
  };
}

/**
 * Inserts a boundary at time t in an IntervalTier, splitting the target interval.
 */
export function insertBoundaryInTier(tier: IntervalTier, time: number): IntervalTier {
  if (time <= tier.xmin || time >= tier.xmax) return tier;

  // Find interval containing time
  const targetIdx = tier.intervals.findIndex(
    (int) => time > int.xmin && time < int.xmax
  );
  if (targetIdx === -1) return tier;

  const target = tier.intervals[targetIdx];
  const left: TextInterval = {
    id: `int_${Date.now()}_left`,
    xmin: target.xmin,
    xmax: time,
    text: target.text,
  };
  const right: TextInterval = {
    id: `int_${Date.now()}_right`,
    xmin: time,
    xmax: target.xmax,
    text: '',
  };

  const newIntervals = [
    ...tier.intervals.slice(0, targetIdx),
    left,
    right,
    ...tier.intervals.slice(targetIdx + 1),
  ];

  return {
    ...tier,
    intervals: newIntervals,
  };
}

/**
 * Moves an inner boundary between intervals[intervalIndex - 1] and intervals[intervalIndex].
 */
export function moveBoundaryInTier(
  tier: IntervalTier,
  intervalIndex: number,
  newTime: number
): IntervalTier {
  if (intervalIndex <= 0 || intervalIndex >= tier.intervals.length) return tier;

  const left = tier.intervals[intervalIndex - 1];
  const right = tier.intervals[intervalIndex];

  // Must remain strictly between left.xmin and right.xmax
  if (newTime <= left.xmin + 0.001 || newTime >= right.xmax - 0.001) {
    return tier;
  }

  const newIntervals = [...tier.intervals];
  newIntervals[intervalIndex - 1] = { ...left, xmax: newTime };
  newIntervals[intervalIndex] = { ...right, xmin: newTime };

  return {
    ...tier,
    intervals: newIntervals,
  };
}

/**
 * Removes boundary between intervalIndex - 1 and intervalIndex, merging them.
 */
export function removeBoundaryFromTier(
  tier: IntervalTier,
  intervalIndex: number
): IntervalTier {
  if (intervalIndex <= 0 || intervalIndex >= tier.intervals.length) return tier;

  const left = tier.intervals[intervalIndex - 1];
  const right = tier.intervals[intervalIndex];

  const mergedText =
    left.text && right.text ? `${left.text} ${right.text}` : (left.text || right.text);

  const merged: TextInterval = {
    id: `int_${Date.now()}_merged`,
    xmin: left.xmin,
    xmax: right.xmax,
    text: mergedText,
  };

  const newIntervals = [
    ...tier.intervals.slice(0, intervalIndex - 1),
    merged,
    ...tier.intervals.slice(intervalIndex + 1),
  ];

  return {
    ...tier,
    intervals: newIntervals,
  };
}

/**
 * Sets text of an interval in an IntervalTier.
 */
export function setIntervalTextInTier(
  tier: IntervalTier,
  intervalIndex: number,
  text: string
): IntervalTier {
  if (intervalIndex < 0 || intervalIndex >= tier.intervals.length) return tier;

  const newIntervals = [...tier.intervals];
  newIntervals[intervalIndex] = {
    ...newIntervals[intervalIndex],
    text,
  };

  return {
    ...tier,
    intervals: newIntervals,
  };
}
