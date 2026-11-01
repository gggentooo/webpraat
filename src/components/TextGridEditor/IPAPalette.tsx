/**
 * Unicode IPA (International Phonetic Alphabet) Character Palette.
 * Provides fast one-click insertion of phonetic symbols into TextGrid annotation intervals.
 */

import React, { useState } from 'react';

export interface IPAPaletteProps {
  onInsert: (char: string) => void;
}

const IPA_GROUPS = [
  {
    name: 'Vowels',
    chars: [
      'i', 'y', 'ɪ', 'ʏ', 'e', 'ø', 'ɛ', 'œ', 'æ', 'a', 'ɶ',
      'ɨ', 'ʉ', 'ɘ', 'ɵ', 'ə', 'ɜ', 'ɞ', 'ɐ',
      'ɯ', 'u', 'ʊ', 'ɤ', 'o', 'ʌ', 'ɔ', 'ɑ', 'ɒ',
    ],
  },
  {
    name: 'Consonants',
    chars: [
      'p', 'b', 't', 'd', 'k', 'ɡ', 'q', 'ɢ', 'ʔ',
      'm', 'n', 'ɲ', 'ŋ', 'ɴ',
      'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'ç', 'x', 'ɣ', 'χ', 'ʁ', 'h', 'ɦ',
      'tʃ', 'dʒ', 'ts', 'dz',
      'r', 'ɾ', 'ɹ', 'l', 'ʎ', 'w', 'j',
    ],
  },
  {
    name: 'Diacritics & Stress',
    chars: [
      'ˈ', 'ˌ', 'ː', 'ˑ', 'ʰ', 'ʲ', 'ʷ', 'ˤ', '˞', '̃', '̥', '̬', '̩', '.', '͜',
    ],
  },
];

export const IPAPalette: React.FC<IPAPaletteProps> = ({ onInsert }) => {
  const [activeGroup, setActiveGroup] = useState<number>(0);

  return (
    <div className="flex items-center space-x-2 bg-slate-100 border border-slate-300 rounded p-1 text-xs select-none">
      {/* Category Tabs */}
      <div className="flex space-x-1 shrink-0 border-r border-slate-300 pr-2">
        {IPA_GROUPS.map((grp, idx) => (
          <button
            key={grp.name}
            type="button"
            onClick={() => setActiveGroup(idx)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeGroup === idx
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            {grp.name}
          </button>
        ))}
      </div>

      {/* Symbol Buttons */}
      <div className="flex flex-wrap items-center gap-1 overflow-x-auto max-h-16 p-0.5">
        {IPA_GROUPS[activeGroup].chars.map((char) => (
          <button
            key={char}
            type="button"
            onClick={() => onInsert(char)}
            className="h-6 min-w-6 px-1.5 rounded border border-slate-300 bg-white text-slate-800 font-serif text-sm hover:bg-blue-50 hover:border-blue-400 active:bg-blue-200 transition-colors shadow-2xs text-center"
            title={`Insert ${char}`}
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
};
