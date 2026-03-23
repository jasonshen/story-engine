'use client';

import { useState } from 'react';
import { WritingEntry, OPENING_LABELS, OpeningStyle } from '@/lib/types';

interface SavedEntriesProps {
  entries: WritingEntry[];
}

function truncate(text: string, wordLimit: number) {
  const words = text.split(/\s+/);
  if (words.length <= wordLimit) return { short: text, isTruncated: false };
  return { short: words.slice(0, wordLimit).join(' '), isTruncated: true };
}

const CaretSVG = () => (
  <svg
    className="saved-caret"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export default function SavedEntries({ entries }: SavedEntriesProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (entries.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="saved-section">
      <div className="saved-title">Saved entries</div>
      <div>
        {entries.map((entry) => {
          const expanded = expandedIds.has(entry.id);
          const { short, isTruncated } = truncate(entry.body, 20);
          const openingLabel = entry.opening_style
            ? OPENING_LABELS[entry.opening_style as OpeningStyle] || entry.opening_style
            : null;

          return (
            <div
              key={entry.id}
              className={`saved-entry ${expanded ? 'expanded' : ''}`}
            >
              <div
                className="saved-entry-toggle"
                onClick={() => toggleExpand(entry.id)}
              >
                <CaretSVG />
                <div className="saved-entry-summary">
                  <div className="saved-entry-label">
                    <span
                      dangerouslySetInnerHTML={{
                        __html: entry.concept_summary,
                      }}
                    />
                    {openingLabel && (
                      <>
                        {' '}
                        <span className="saved-entry-label-opening">
                          {openingLabel}
                        </span>
                      </>
                    )}
                    {' '}
                    <span className="saved-entry-label-meta">
                      {entry.word_count} words
                    </span>
                  </div>
                  {!expanded && (
                    <div className="saved-entry-preview">
                      {short}
                      {isTruncated && (
                        <span className="saved-entry-preview-ellipsis">...</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {expanded && (
                <div className="saved-entry-full">
                  <div className="saved-entry-full-text">{entry.body}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
