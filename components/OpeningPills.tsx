'use client';

import { OpeningStyle, OPENING_LABELS } from '@/lib/types';

interface OpeningPillsProps {
  selected: OpeningStyle | null;
  onSelect: (style: OpeningStyle | null) => void;
}

const STYLES: OpeningStyle[] = [
  'dialogue',
  'action',
  'suspense',
  'monologue',
  'object',
  'setting',
  'character',
];

export default function OpeningPills({ selected, onSelect }: OpeningPillsProps) {
  return (
    <div className="chips" role="group" aria-label="Begin with">
      {STYLES.map((style) => (
        <button
          key={style}
          type="button"
          className={`chip ${selected === style ? 'selected' : ''}`}
          aria-pressed={selected === style}
          onClick={() => onSelect(selected === style ? null : style)}
        >
          {OPENING_LABELS[style]}
        </button>
      ))}
    </div>
  );
}
