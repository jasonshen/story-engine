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

/** Tighter display labels; the stored value and full label stay the same. */
export const OPENING_SHORT: Record<OpeningStyle, string> = {
  dialogue: 'Dialogue',
  action: 'In medias res',
  suspense: 'Slow build',
  monologue: 'Inner monologue',
  object: 'An object',
  setting: 'The setting',
  character: 'A character',
};

export default function OpeningPills({ selected, onSelect }: OpeningPillsProps) {
  return (
    <div className="opening" role="group" aria-label="Begin with">
      <div className="field-label">Begin with</div>
      <div className="pills">
        {STYLES.map((style) => (
          <button
            key={style}
            type="button"
            className={`pill ${selected === style ? 'selected' : ''}`}
            aria-pressed={selected === style}
            title={OPENING_LABELS[style]}
            onClick={() => onSelect(selected === style ? null : style)}
          >
            {OPENING_SHORT[style]}
          </button>
        ))}
      </div>
    </div>
  );
}
