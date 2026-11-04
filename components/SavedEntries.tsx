'use client';

import { useState } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { WritingEntry, OPENING_LABELS, OpeningStyle } from '@/lib/types';

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
    <section className="archive-section" aria-labelledby="saved-title">
      <h2 className="archive-title" id="saved-title">
        Saved entries
      </h2>
      {entries.length === 0 ? (
        <p className="archive-empty">Entries you save from the page will collect here.</p>
      ) : (
        <ul className="archive-list">
          {entries.map((entry) => {
            const expanded = expandedIds.has(entry.id);
            const { short, isTruncated } = truncate(entry.body, 20);
            const openingLabel = entry.opening_style
              ? OPENING_LABELS[entry.opening_style as OpeningStyle] || entry.opening_style
              : null;

            return (
              <li key={entry.id} className={`saved-entry ${expanded ? 'expanded' : ''}`}>
                <button
                  type="button"
                  className="saved-entry-toggle"
                  aria-expanded={expanded}
                  onClick={() => toggleExpand(entry.id)}
                >
                  <CaretRight className="saved-caret" aria-hidden="true" />
                  <span className="saved-entry-summary">
                    <span
                      className="saved-entry-label"
                      dangerouslySetInnerHTML={{ __html: entry.concept_summary }}
                    />
                    <span className="saved-entry-meta">
                      {openingLabel && <span>{openingLabel}</span>}
                      <span>{entry.word_count} words</span>
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
    </section>
  );
}
