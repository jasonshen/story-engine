'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { CardType } from '@/lib/types';
import { getRandomLabels } from '@/lib/data';

interface ClickableElementProps {
  text: string;
  className: string;
  onReroll: () => void;
  title?: string;
  cardType?: CardType;
  /** When this value changes (and is > 0), play the shuffle-in animation */
  shuffleKey?: number;
  /** Duration of the shuffle in ms (default 500 for generate, 1000 for reroll) */
  shuffleDuration?: number;
  /** Custom source of random labels for the shuffle (used instead of cardType) */
  randomLabel?: () => string;
}

const SHUFFLE_INTERVAL = 60; // ms between label swaps

export default function ClickableElement({
  text,
  className,
  onReroll,
  title = 'Click to re-roll',
  cardType,
  shuffleKey = 0,
  shuffleDuration = 500,
  randomLabel,
}: ClickableElementProps) {
  // Keep the label source in a ref so a new function identity each render
  // doesn't retrigger the shuffle effect.
  const labelSourceRef = useRef<(() => string) | null>(null);
  labelSourceRef.current =
    randomLabel ?? (cardType ? () => getRandomLabels(cardType, 1)[0] : null);
  const canShuffle = !!(randomLabel || cardType);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [displayText, setDisplayText] = useState(text);
  const [isShuffling, setIsShuffling] = useState(false);
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // When the real text changes (after shuffle or direct update), sync it
  useEffect(() => {
    if (!isShuffling) {
      setDisplayText(text);
    }
  }, [text, isShuffling]);

  // Shuffle-in animation on generate (triggered by shuffleKey changing)
  useEffect(() => {
    if (shuffleKey === 0 || !canShuffle) return;

    setIsShuffling(true);

    // Cycle through random labels
    intervalRef.current = setInterval(() => {
      const next = labelSourceRef.current;
      if (next) setDisplayText(next());
    }, SHUFFLE_INTERVAL);

    // Stop after duration, land on the real text
    shuffleTimerRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayText(text);
      setIsShuffling(false);
    }, shuffleDuration);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (shuffleTimerRef.current) clearTimeout(shuffleTimerRef.current);
    };
  }, [shuffleKey, canShuffle, shuffleDuration, text]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isShuffling) return; // don't allow clicks during shuffle

      if (!canShuffle) {
        // No label source — use the old swap animation
        const span = spanRef.current;
        if (!span) return;
        span.classList.add('el-swapping');
        setTimeout(() => {
          onReroll();
          span.classList.remove('el-swapping');
        }, 170);
        return;
      }

      // Reroll with shuffle animation (2x duration)
      setIsShuffling(true);
      const rerollDuration = 1000;

      intervalRef.current = setInterval(() => {
        const next = labelSourceRef.current;
        if (next) setDisplayText(next());
      }, SHUFFLE_INTERVAL);

      // Fire the reroll partway through so the new value is ready
      setTimeout(() => {
        onReroll();
      }, rerollDuration * 0.7);

      shuffleTimerRef.current = setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsShuffling(false);
        // text prop will have updated from onReroll, useEffect will sync displayText
      }, rerollDuration);
    },
    [onReroll, canShuffle, isShuffling]
  );

  return (
    <span
      ref={spanRef}
      className={`el ${className} ${isShuffling ? 'el-shuffling' : ''}`}
      onClick={handleClick}
      title={title}
    >
      {displayText}
    </span>
  );
}
