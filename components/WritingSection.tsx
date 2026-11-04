'use client';

import { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Check, PencilSimpleLine } from '@phosphor-icons/react';
import { OpeningStyle } from '@/lib/types';
import Timer, { TimerHandle } from './Timer';
import OpeningPills from './OpeningPills';

export interface WritingSectionHandle {
  reset: () => void;
}

interface WritingSectionProps {
  /** The pad unlocks once there is something to write from */
  ready: boolean;
  prompt?: string;
  placeholder?: string;
  /** Shown in the pad before anything has been generated */
  emptyHint?: string;
  onSave: (data: {
    opening_style: string | null;
    body: string;
    word_count: number;
    duration_seconds: number | null;
  }) => void;
}

const WritingSection = forwardRef<WritingSectionHandle, WritingSectionProps>(
  function WritingSection(
    {
      ready,
      onSave,
      prompt = 'Now write the opening...',
      placeholder = 'The story begins here...',
      emptyHint = 'Generate a story and your writing pad opens here.',
    },
    ref
  ) {
    const [text, setText] = useState('');
    const [openingStyle, setOpeningStyle] = useState<OpeningStyle | null>(null);
    const [saved, setSaved] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const timerRef = useRef<TimerHandle>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        setText('');
        setOpeningStyle(null);
        setSaved(false);
        setShowToast(false);
        timerRef.current?.reset();
      },
    }));

    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      setSaved(false);
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
    }, [text, ready, openingStyle, wordCount, onSave]);

    const handleTimerStart = useCallback(() => {
      textareaRef.current?.focus();
    }, []);

    if (!ready) {
      return (
        <div className="pad pad-empty">
          <span className="pad-empty-icon" aria-hidden="true">
            <PencilSimpleLine size={24} />
          </span>
          <p className="pad-empty-title">Writing pad</p>
          <p className="pad-empty-sub">{emptyHint}</p>
          <p className="pad-empty-sub">
            Five minutes on the clock, one opening move, then save.
          </p>
        </div>
      );
    }

    return (
      <div className="pad">
        <div className="pad-head">
          <p className="pad-prompt">{prompt}</p>
          <Timer ref={timerRef} onStart={handleTimerStart} />
        </div>

        <OpeningPills selected={openingStyle} onSelect={setOpeningStyle} />

        <textarea
          ref={textareaRef}
          className="pad-text"
          aria-label="Your writing"
          placeholder={placeholder}
          value={text}
          onChange={handleTextChange}
        />

        <div className="pad-foot">
          <span className="word-count">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
          <div className="pad-foot-actions">
            <span className={`save-toast ${showToast ? 'show' : ''}`} role="status">
              {showToast ? 'Saved.' : ''}
            </span>
            <button
              type="button"
              className={`btn-save ${saved ? 'saved' : ''}`}
              onClick={handleSave}
              disabled={!text.trim() && !saved}
            >
              {saved && <Check size={14} weight="bold" aria-hidden="true" />}
              {saved ? 'Saved' : 'Save entry'}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

export default WritingSection;
