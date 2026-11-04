'use client';

import { useEffect, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { Concept, WritingEntry } from '@/lib/types';
import { Character } from '@/lib/character-types';
import SavedEntries from './SavedEntries';
import ConceptHistory, { CharacterHistory } from './ConceptHistory';

interface ArchivePanelProps {
  open: boolean;
  onClose: () => void;
  tab: 'story' | 'character';
  entries: WritingEntry[];
  storyHistory: Concept[];
  characterHistory: Character[];
}

/** Slide-over holding everything from earlier: saved writing and past rolls. */
export default function ArchivePanel({
  open,
  onClose,
  tab,
  entries,
  storyHistory,
  characterHistory,
}: ArchivePanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      returnRef.current = document.activeElement as HTMLElement | null;
      closeRef.current?.focus();
    } else if (returnRef.current) {
      returnRef.current.focus?.();
      returnRef.current = null;
    }
  }, [open]);

  return (
    <>
      <div className="drawer-scrim" data-open={open} onClick={onClose} aria-hidden="true" />
      <aside
        className="drawer"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-heading"
        aria-hidden={!open}
        inert={!open ? ('' as unknown as boolean) : undefined}
      >
        <div className="drawer-head">
          <h2 id="archive-heading" className="drawer-title">
            Archive
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close archive"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="drawer-body">
          <SavedEntries entries={entries} />
          {tab === 'story' ? (
            <ConceptHistory history={storyHistory} />
          ) : (
            <CharacterHistory history={characterHistory} />
          )}
        </div>
      </aside>
    </>
  );
}
