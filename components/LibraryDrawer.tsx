'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from '@phosphor-icons/react';

export interface LibraryView {
  id: string;
  label: string;
  count: number;
  content: React.ReactNode;
}

interface LibraryDrawerProps {
  open: boolean;
  onClose: () => void;
  views: LibraryView[];
  /** Element to hand focus back to on close */
  returnFocusRef: React.RefObject<HTMLElement>;
}

/**
 * Side sheet for saved entries and roll history. It stays mounted (made inert
 * while closed) so expanded entries and the chosen view survive closing it.
 */
export default function LibraryDrawer({
  open,
  onClose,
  views,
  returnFocusRef,
}: LibraryDrawerProps) {
  const [view, setView] = useState(views[0]?.id);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.toggleAttribute('inert', !open);
    if (open) {
      closeRef.current?.focus();
    } else if (wasOpen.current) {
      returnFocusRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const active = views.find((v) => v.id === view) ?? views[0];

  return (
    <div ref={rootRef} className={`drawer-root ${open ? 'open' : ''}`}>
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-title"
      >
        <div className="drawer-head">
          <h2 className="drawer-title" id="library-title">
            Library
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close library"
            title="Close (Esc)"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="segmented segmented-full" role="tablist" aria-label="Library view">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={active?.id === v.id}
              className={`seg ${active?.id === v.id ? 'seg-active' : ''}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
              <span className="seg-count">{v.count}</span>
            </button>
          ))}
        </div>
        <div className="drawer-body">
          {views.map((v) => (
            <div key={v.id} role="tabpanel" hidden={v.id !== active?.id}>
              {v.content}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
