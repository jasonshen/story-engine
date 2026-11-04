'use client';

import { useState } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { WritingEntry, OPENING_LABELS, OpeningStyle } from '@/lib/types';
import { OPENING_SHORT } from './OpeningPills';

interface SavedEntriesProps {
  entries: WritingEntry[];
}

function truncate(text: string, wordLimit: number) {
  const words = text.split(/\s+/);
  if (words.length <= wordLimit) return { short: text, isTruncated: false };
  return { short: words.slice(0, wordLimit).join(' '), isTruncated: true };
}

export default function SavedEntries({ entries }: SavedEntriesProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (entries.length === 0) {
    return (
      <div className="list-empty">
        Nothing saved yet. Write something in the pad and press Save entry.
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ul className="entry-list">
      {entries.map((entry, idx) => {
        const key = entry.id ?? `entry-${idx}`;
        const expanded = expandedIds.has(key);
        const { short, isTruncated } = truncate(entry.body, 20);
        const style = entry.opening_style as OpeningStyle | null;
        const openingLabel = style
          ? OPENING_SHORT[style] || OPENING_LABELS[style] || entry.opening_style
          : null;

        return (
          <li key={key} className={`entry ${expanded ? 'expanded' : ''}`}>
            <button
              type="button"
              className="entry-toggle"
              aria-expanded={expanded}
              onClick={() => toggleExpand(key)}
            >
              <CaretRight className="entry-caret" size={14} weight="bold" aria-hidden="true" />
              <span className="entry-summary">
                <span
                  className="entry-label hl"
                  dangerouslySetInnerHTML={{ __html: entry.concept_summary }}
                />
                <span className="entry-meta">
                  {openingLabel && <span className="tag">{openingLabel}</span>}
                  <span>{entry.word_count} words</span>
                </span>
                {!expanded && (
                  <span className="entry-preview">
                    {short}
                    {isTruncated && '...'}
                  </span>
                )}
              </span>
            </button>
            {expanded && <div className="entry-full">{entry.body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
