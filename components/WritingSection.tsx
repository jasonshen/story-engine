'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { OpeningStyle } from '@/lib/types';
import Timer, { TimerHandle } from './Timer';
import OpeningPills from './OpeningPills';

/**
 * Writing state lives in a hook so the page (the text itself) and the margin
 * (timer, opening style) can render in different places while sharing it.
 */
export function useWriting() {
  const [text, setText] = useState('');
  const [openingStyle, setOpeningStyle] = useState<OpeningStyle | null>(null);
  const [saved, setSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const timerRef = useRef<TimerHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const reset = useCallback(() => {
    setText('');
    setOpeningStyle(null);
    setSaved(false);
    setShowToast(false);
    timerRef.current?.reset();
  }, []);

  return {
    text,
    setText,
    openingStyle,
    setOpeningStyle,
    saved,
    setSaved,
    showToast,
    setShowToast,
    timerRef,
    textareaRef,
    reset,
  };
}

export type Writing = ReturnType<typeof useWriting>;

export interface SavePayload {
  opening_style: string | null;
  body: string;
  word_count: number;
  duration_seconds: number | null;
}

interface WritingSheetProps {
  w: Writing;
  /** Show the section only once there is something to write from */
  ready: boolean;
  prompt?: string;
  placeholder?: string;
  onSave: (data: SavePayload) => void;
}

/** The writing surface: flows directly under the prompt as part of the page. */
export function WritingSheet({
  w,
  ready,
  onSave,
  prompt = 'Now write the opening...',
  placeholder = 'The story begins here...',
}: WritingSheetProps) {
  const { text, setText, openingStyle, saved, setSaved, showToast, setShowToast, textareaRef } = w;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Auto-grow: the page gets longer as you write, no inner scrollbar.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text, ready, textareaRef]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      setSaved(false);
    },
    [setText, setSaved]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Esc hands the keyboard back to the shortcuts
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!text.trim() || !ready) return;
    onSave({
      opening_style: openingStyle,
      body: text.trim(),
      word_count: wordCount,
      duration_seconds: null,
    });
    setSaved(true);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }, [text, ready, openingStyle, wordCount, onSave, setSaved, setShowToast]);

  if (!ready) return null;

  return (
    <section className="sheet" aria-label="Your writing">
      <p className="sheet-prompt">{prompt}</p>
      <textarea
        ref={textareaRef}
        className="sheet-area"
        placeholder={placeholder}
        aria-label={prompt}
        value={text}
        rows={8}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <div className="sheet-footer">
        <span className="sheet-count" aria-live="polite">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
        <div className="sheet-actions">
          <span className={`save-toast ${showToast ? 'show' : ''}`} role="status">
            {showToast ? 'Saved.' : ''}
          </span>
          <button
            type="button"
            className={`btn btn-quiet ${saved ? 'is-saved' : ''}`}
            onClick={handleSave}
            disabled={!text.trim()}
          >
            {saved ? 'Saved' : 'Save entry'}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Margin tools for the writing session: timer and opening style. */
export function WritingTools({ w, ready }: { w: Writing; ready: boolean }) {
  const { timerRef, textareaRef, openingStyle, setOpeningStyle } = w;
  const handleTimerStart = useCallback(() => {
    textareaRef.current?.focus();
  }, [textareaRef]);

  if (!ready) return null;

  return (
    <>
      <div className="tool">
        <div className="tool-label">Timer</div>
        <Timer ref={timerRef} onStart={handleTimerStart} />
      </div>
      <div className="tool">
        <div className="tool-label">Begin with</div>
        <OpeningPills selected={openingStyle} onSelect={setOpeningStyle} />
      </div>
    </>
  );
}
