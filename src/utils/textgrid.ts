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

/**
 * Inserts an interval on an IntervalTier between tmin and tmax,
 * adding boundaries at both ends if needed.
 */
export function insertIntervalOnTier(
  tier: IntervalTier,
  start: number,
  end: number,
  text = ''
): { updatedTier: IntervalTier; newIntervalIndex: number } {
  const s0 = Math.max(tier.xmin, Math.min(start, end));
  const s1 = Math.min(tier.xmax, Math.max(start, end));

  if (s1 - s0 < 0.0005) {
    let curTier = tier;
    if (s0 > tier.xmin + 0.0005 && s0 < tier.xmax - 0.0005) {
      curTier = insertBoundaryInTier(tier, s0);
    }
    const idx = curTier.intervals.findIndex(
      (it) => s0 >= it.xmin - 0.0005 && s0 <= it.xmax + 0.0005
    );
    return {
      updatedTier: curTier,
      newIntervalIndex: Math.max(0, idx),
    };
  }

  let curTier = tier;

  // Insert boundary at s0 if needed
  if (s0 > tier.xmin + 0.0005) {
    const existing = curTier.intervals.some(
      (it) => Math.abs(it.xmin - s0) < 0.0005 || Math.abs(it.xmax - s0) < 0.0005
    );
    if (!existing) {
      curTier = insertBoundaryInTier(curTier, s0);
    }
  }

  // Insert boundary at s1 if needed
  if (s1 < tier.xmax - 0.0005) {
    const existing = curTier.intervals.some(
      (it) => Math.abs(it.xmin - s1) < 0.0005 || Math.abs(it.xmax - s1) < 0.0005
    );
    if (!existing) {
      curTier = insertBoundaryInTier(curTier, s1);
    }
  }

  // Find the created interval
  let targetIdx = curTier.intervals.findIndex(
    (it) => Math.abs(it.xmin - s0) < 0.001 && Math.abs(it.xmax - s1) < 0.001
  );

  if (targetIdx === -1) {
    targetIdx = curTier.intervals.findIndex(
      (it) => it.xmin >= s0 - 0.001 && it.xmax <= s1 + 0.001
    );
  }

  if (targetIdx !== -1 && text) {
    curTier = setIntervalTextInTier(curTier, targetIdx, text);
  }

  return {
    updatedTier: curTier,
    newIntervalIndex: Math.max(0, targetIdx),
  };
}

/**
 * Removes an interval by merging it with neighbor or clearing its label.
 */
export function removeIntervalFromTier(
  tier: IntervalTier,
  intervalIndex: number
): IntervalTier {
  if (intervalIndex < 0 || intervalIndex >= tier.intervals.length) return tier;

  if (tier.intervals.length <= 1) {
    return setIntervalTextInTier(tier, 0, '');
  }

  if (intervalIndex > 0) {
    return removeBoundaryFromTier(tier, intervalIndex);
  }

  // First interval: remove right boundary
  return removeBoundaryFromTier(tier, 1);
}

/**
 * Adds an IntervalTier to TextGridData at specified 1-based position.
 */
export function addIntervalTierToGrid(
  grid: TextGridData,
  position: number,
  name: string
): TextGridData {
  const tierName = name.trim() || `Tier_${grid.tiers.length + 1}`;
  const pos = Math.max(1, Math.min(position, grid.tiers.length + 1));

  const newTier: IntervalTier = {
    type: 'IntervalTier',
    name: tierName,
    xmin: grid.xmin,
    xmax: grid.xmax,
    intervals: [
      {
        id: `int_${Date.now()}_0`,
        xmin: grid.xmin,
        xmax: grid.xmax,
        text: '',
      },
    ],
  };

  const updatedTiers = [...grid.tiers];
  updatedTiers.splice(pos - 1, 0, newTier);

  return {
    ...grid,
    tiers: updatedTiers,
  };
}

/**
 * Adds a PointTier to TextGridData at specified 1-based position.
 */
export function addPointTierToGrid(
  grid: TextGridData,
  position: number,
  name: string
): TextGridData {
  const tierName = name.trim() || `Points_${grid.tiers.length + 1}`;
  const pos = Math.max(1, Math.min(position, grid.tiers.length + 1));

  const newTier: PointTier = {
    type: 'TextTier',
    name: tierName,
    xmin: grid.xmin,
    xmax: grid.xmax,
    points: [],
  };

  const updatedTiers = [...grid.tiers];
  updatedTiers.splice(pos - 1, 0, newTier);

  return {
    ...grid,
    tiers: updatedTiers,
  };
}

/**
 * Removes a tier by index from TextGridData.
 */
export function removeTierFromGrid(
  grid: TextGridData,
  tierIndex: number
): TextGridData {
  if (grid.tiers.length <= 1) {
    throw new Error('Cannot remove the last remaining tier in TextGrid');
  }
  if (tierIndex < 0 || tierIndex >= grid.tiers.length) return grid;

  const updatedTiers = grid.tiers.filter((_, idx) => idx !== tierIndex);
  return {
    ...grid,
    tiers: updatedTiers,
  };
}

/**
 * Duplicates a tier by index into a new position with a new name.
 */
export function duplicateTierInGrid(
  grid: TextGridData,
  tierIndex: number,
  position: number,
  name: string
): TextGridData {
  if (tierIndex < 0 || tierIndex >= grid.tiers.length) return grid;

  const sourceTier = grid.tiers[tierIndex];
  const newName = name.trim() || `${sourceTier.name}_copy`;
  const pos = Math.max(1, Math.min(position, grid.tiers.length + 1));

  const duplicated: TextGridTier = structuredClone(sourceTier);
  duplicated.name = newName;

  const updatedTiers = [...grid.tiers];
  updatedTiers.splice(pos - 1, 0, duplicated);

  return {
    ...grid,
    tiers: updatedTiers,
  };
}

/**
 * Renames a tier by index.
 */
export function renameTierInGrid(
  grid: TextGridData,
  tierIndex: number,
  newName: string
): TextGridData {
  if (tierIndex < 0 || tierIndex >= grid.tiers.length) return grid;

  const updatedTiers = [...grid.tiers];
  updatedTiers[tierIndex] = {
    ...updatedTiers[tierIndex],
    name: newName.trim() || updatedTiers[tierIndex].name,
  };

  return {
    ...grid,
    tiers: updatedTiers,
  };
}
