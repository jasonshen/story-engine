'use client';

import { useId } from 'react';
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
  const labelId = useId();
  return (
    <div className="field">
      <div className="field-label" id={labelId}>
        Begin with
      </div>
      <div className="pills" role="group" aria-labelledby={labelId}>
        {STYLES.map((style) => (
          <button
            key={style}
            type="button"
            className={`pill ${selected === style ? 'selected' : ''}`}
            aria-pressed={selected === style}
            onClick={() => onSelect(selected === style ? null : style)}
          >
            {OPENING_LABELS[style]}
          </button>
        ))}
      </div>
    </div>
  );
}
