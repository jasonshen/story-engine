'use client';

import { useCallback, useEffect, useRef } from 'react';
import { motion, useAnimate, useReducedMotion } from 'motion/react';
import { CardsIcon } from '@phosphor-icons/react';

interface DealButtonProps {
  onDeal: () => void;
  /** Only the visible tab listens for the keyboard shortcut */
  active: boolean;
  label?: string;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  );
}

export default function DealButton({ onDeal, active, label = 'Deal' }: DealButtonProps) {
  const reduce = useReducedMotion();
  const [iconRef, animate] = useAnimate<HTMLSpanElement>();
  const onDealRef = useRef(onDeal);
  onDealRef.current = onDeal;

  const deal = useCallback(() => {
    if (!reduce && iconRef.current) {
      animate(
        iconRef.current,
        { rotate: [0, -28, 12, 0], scale: [1, 1.15, 1] },
        { duration: 0.5, ease: 'easeOut' }
      );
    }
    onDealRef.current();
  }, [reduce, animate, iconRef]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'g' && e.key !== 'G') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      deal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, deal]);

  return (
    <motion.button
      type="button"
      className="deal-btn"
      onClick={deal}
      aria-keyshortcuts="G"
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
    >
      <span ref={iconRef} className="deal-btn-icon" aria-hidden="true">
        <CardsIcon size={24} weight="fill" />
      </span>
      <span className="deal-btn-label">{label}</span>
      <kbd className="deal-btn-kbd" aria-hidden="true">
        G
      </kbd>
    </motion.button>
  );
}
