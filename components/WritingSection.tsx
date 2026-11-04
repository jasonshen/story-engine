'use client';

import { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { OpeningStyle } from '@/lib/types';
import Timer, { TimerHandle } from './Timer';
import OpeningPills from './OpeningPills';

export interface WritingSectionHandle {
  reset: () => void;
}

interface WritingSectionProps {
  /** Show the section only once there is something to write from */
  ready: boolean;
  prompt?: string;
  placeholder?: string;
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

    if (!ready) return null;

    return (
      <div className="writing-section">
        <div className="writing-header">
          <div className="writing-prompt">{prompt}</div>
          <Timer ref={timerRef} onStart={handleTimerStart} />
        </div>

        <OpeningPills selected={openingStyle} onSelect={setOpeningStyle} />

        <textarea
          ref={textareaRef}
          className="writing-area"
          placeholder={placeholder}
          value={text}
          onChange={handleTextChange}
        />

        <div className="writing-footer">
          <span className="word-count">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className={`save-toast ${showToast ? 'show' : ''}`}>
              Saved.
            </span>
            <button
              className={`btn-save ${saved ? 'saved' : ''}`}
              onClick={handleSave}
            >
              {saved ? 'Saved' : 'Save entry'}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

export default WritingSection;
