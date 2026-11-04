'use client';

import { useState } from 'react';
import { CaretRightIcon } from '@phosphor-icons/react';
import { WritingEntry, OPENING_LABELS, OpeningStyle } from '@/lib/types';
import Drawer from './Drawer';

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

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Drawer title="Saved entries" count={entries.length} defaultOpen>
      {entries.length === 0 ? (
        <p className="drawer-empty">Nothing saved yet. Write a few lines and press Save entry.</p>
      ) : (
        <ul className="saved-list">
          {entries.map((entry, i) => {
            const key = entry.id ?? `entry-${i}`;
            const expanded = expandedIds.has(key);
            const { short, isTruncated } = truncate(entry.body, 20);
            const openingLabel = entry.opening_style
              ? OPENING_LABELS[entry.opening_style as OpeningStyle] || entry.opening_style
              : null;

            return (
              <li key={key} className={`saved-entry ${expanded ? 'expanded' : ''}`}>
                <button
                  type="button"
                  className="saved-entry-toggle"
                  aria-expanded={expanded}
                  onClick={() => toggleExpand(key)}
                >
                  <CaretRightIcon
                    className="saved-caret"
                    size={14}
                    weight="bold"
                    aria-hidden="true"
                  />
                  <span className="saved-entry-summary">
                    <span
                      className="saved-entry-label"
                      dangerouslySetInnerHTML={{ __html: entry.concept_summary }}
                    />
                    <span className="saved-entry-tags">
                      {openingLabel && <span className="tag">{openingLabel}</span>}
                      <span className="tag tag-plain">{entry.word_count} words</span>
                    </span>
                    {!expanded && (
                      <span className="saved-entry-preview">
                        {short}
                        {isTruncated && '...'}
                      </span>
                    )}
                  </span>
                </button>
                {expanded && <div className="saved-entry-full">{entry.body}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
