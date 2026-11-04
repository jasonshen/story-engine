'use client';

import { Character } from '@/lib/character-types';
import { characterText } from '@/lib/character-engine';

export default function CharacterHistory({ history }: { history: Character[] }) {
  if (history.length === 0) {
    return (
      <div className="list-empty">Characters will collect here as you generate.</div>
    );
  }

  return (
    <ol className="history-list">
      {[...history].reverse().map((c, idx) => (
        <li key={`${c.id}-${idx}`} className="history-item">
          <div className="history-num">No. {history.length - idx}</div>
          <div className="history-logline">{characterText(c)}</div>
          {c.sketch && <div className="history-narr">{c.sketch}</div>}
        </li>
      ))}
    </ol>
  );
}
