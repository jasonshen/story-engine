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
    <div className="opening-section">
      <div className="opening-label">Begin with</div>
      <div className="opening-pills">
        {STYLES.map((style) => (
          <button
            key={style}
            className={`pill ${selected === style ? 'selected' : ''}`}
            onClick={() => onSelect(selected === style ? null : style)}
          >
            {OPENING_LABELS[style]}
          </button>
        ))}
      </div>
    </div>
  );
}
