'use client';

import {
  useState,
  useRef,
  useCallback,
  useId,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { CheckIcon, FloppyDiskIcon, PenNibIcon, WarningIcon } from '@phosphor-icons/react';
import { OpeningStyle } from '@/lib/types';
import Timer, { TimerHandle } from './Timer';
import OpeningPills from './OpeningPills';

export interface WritingSectionHandle {
  reset: () => void;
}

/** 'saved' = stored on the server; 'local' = kept on this page only. */
export type SaveResult = 'saved' | 'local';

interface WritingSectionProps {
  /** Writing unlocks once there is something to write from */
  ready: boolean;
  prompt?: string;
  placeholder?: string;
  /** Shown before the first deal */
  emptyText?: string;
  onSave: (data: {
    opening_style: string | null;
    body: string;
    word_count: number;
    duration_seconds: number | null;
  }) => Promise<SaveResult> | void;
}

const WritingSection = forwardRef<WritingSectionHandle, WritingSectionProps>(
  function WritingSection(
    {
      ready,
      onSave,
      prompt = 'Now write the opening...',
      placeholder = 'The story begins here...',
      emptyText = 'Deal first, then write here.',
    },
    ref
  ) {
    const [text, setText] = useState('');
    const [openingStyle, setOpeningStyle] = useState<OpeningStyle | null>(null);
    const [saved, setSaved] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [toastWarn, setToastWarn] = useState(false);
    const timerRef = useRef<TimerHandle>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout>>();
    const areaId = useId();

    useImperativeHandle(ref, () => ({
      reset: () => {
        setText('');
        setOpeningStyle(null);
        setSaved(false);
        setToast(null);
        timerRef.current?.reset();
      },
    }));

    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      setSaved(false);
    }, []);

    const flash = useCallback((msg: string, warn: boolean, ms: number) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(msg);
      setToastWarn(warn);
      toastTimer.current = setTimeout(() => setToast(null), ms);
    }, []);

    const handleSave = useCallback(async () => {
      if (!text.trim() || !ready) return;
      setSaved(true);
      const result = await onSave({
        opening_style: openingStyle,
        body: text.trim(),
        word_count: wordCount,
        duration_seconds: null,
      });
      if (result === 'local') {
        flash('Kept on this page only. The server could not store it.', true, 5000);
      } else {
        flash('Saved.', false, 2000);
      }
    }, [text, ready, openingStyle, wordCount, onSave, flash]);

    const handleTimerStart = useCallback(() => {
      textareaRef.current?.focus();
    }, []);

    if (!ready) {
      return (
        <div className="pad-inner pad-empty">
          <PenNibIcon size={28} weight="duotone" aria-hidden="true" />
          <p>{emptyText}</p>
          <p className="pad-empty-sub">A 5 minute timer, an opening style and a blank page wait here.</p>
        </div>
      );
    }

    return (
      <div className="pad-inner">
        <div className="pad-head">
          <label className="pad-prompt" htmlFor={areaId}>
            {prompt}
          </label>
          <Timer ref={timerRef} onStart={handleTimerStart} />
        </div>

        <OpeningPills selected={openingStyle} onSelect={setOpeningStyle} />

        <textarea
          id={areaId}
          ref={textareaRef}
          className="writing-area"
          placeholder={placeholder}
          value={text}
          onChange={handleTextChange}
        />

        <div className="pad-foot">
          <span className="word-count">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
          <span
            className={`save-toast ${toast ? 'show' : ''} ${toastWarn ? 'warn' : ''}`}
            role="status"
          >
            {toast && toastWarn && <WarningIcon size={14} weight="bold" aria-hidden="true" />}
            {toast}
          </span>
          <button
            type="button"
            className={`btn-save ${saved ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={!text.trim()}
          >
            {saved ? (
              <CheckIcon size={16} weight="bold" aria-hidden="true" />
            ) : (
              <FloppyDiskIcon size={16} weight="bold" aria-hidden="true" />
            )}
            {saved ? 'Saved' : 'Save entry'}
          </button>
        </div>
      </div>
    );
  }
);

export default WritingSection;
