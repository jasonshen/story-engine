'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useAnimate, useReducedMotion } from 'motion/react';
import {
  ArrowsClockwiseIcon,
  LockSimpleIcon,
  LockSimpleOpenIcon,
  ProhibitIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

export interface PlayCardProps {
  /** Small category label printed on the card, e.g. "Character" */
  category: string;
  icon: Icon;
  value: string;
  onReroll: () => void;
  /** Tooltip / accessible hint for the re-roll action */
  title: string;
  /** Size and styling variant (maps to a CSS modifier) */
  variant: string;
  /** Position in the deal, used to stagger the deal-in */
  dealIndex?: number;
  /** Small connective text printed before the value */
  lead?: string;
  /** Wrap the value in typographic quotes */
  quote?: boolean;
  /** Short metadata line under the value */
  meta?: React.ReactNode;
  /** Re-rolling would break another lock */
  blocked?: boolean;
  locked?: boolean;
  /** When present the card shows a lock toggle in its corner */
  onToggleLock?: () => void;
  className?: string;
}

// A small, stable tilt per card so the spread reads as cards on a table.
const TILTS = [-0.6, 0.45, -0.25, 0.7, -0.5, 0.3, -0.7, 0.55, -0.35, 0.2];

export default function PlayCard({
  category,
  icon: CatIcon,
  value,
  onReroll,
  title,
  variant,
  dealIndex = 0,
  quote = false,
  lead,
  meta,
  blocked = false,
  locked = false,
  onToggleLock,
  className = '',
}: PlayCardProps) {
  const reduce = useReducedMotion();
  const [faceRef, animate] = useAnimate<HTMLButtonElement>();
  const prevValue = useRef(value);
  const busy = useRef(false);
  const [rollTick, setRollTick] = useState(0);
  const mounted = useRef(false);

  // Turn the card face back over whenever its value changes (a direct
  // re-roll, or a cascade from another card), or after a re-roll that
  // happened to land on the same text.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const changed = prevValue.current !== value;
    prevValue.current = value;
    if (!changed && rollTick === 0) return;
    const el = faceRef.current;
    if (!el) return;
    if (reduce) {
      animate(el, { opacity: [0.2, 1] }, { duration: 0.22 });
    } else {
      animate(
        el,
        { rotateY: [-90, 0] },
        { type: 'spring', stiffness: 340, damping: 22, mass: 0.7 }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, rollTick, reduce]);

  const handleClick = useCallback(async () => {
    if (blocked || busy.current) return;
    busy.current = true;
    const el = faceRef.current;
    try {
      if (el) {
        if (reduce) {
          await animate(el, { opacity: 0.2 }, { duration: 0.12 });
        } else {
          await animate(el, { rotateY: 90 }, { duration: 0.14, ease: [0.5, 0, 1, 1] });
        }
      }
    } finally {
      onReroll();
      setRollTick((t) => t + 1);
      busy.current = false;
    }
  }, [blocked, reduce, animate, faceRef, onReroll]);

  const tilt = locked ? 0 : TILTS[dealIndex % TILTS.length];

  return (
    <motion.div
      className={`pcard pcard--${variant} ${locked ? 'is-locked' : ''} ${
        blocked ? 'is-blocked' : ''
      } ${onToggleLock ? 'has-lock' : ''} ${className}`}
      initial={
        reduce
          ? { opacity: 0 }
          : { opacity: 0, y: -26, rotate: tilt * 6, scale: 0.94 }
      }
      animate={{ opacity: 1, y: 0, rotate: tilt, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 24,
        delay: Math.min(dealIndex, 14) * 0.045,
      }}
      whileHover={
        blocked
          ? undefined
          : { y: -3, transition: { type: 'spring', stiffness: 420, damping: 26 } }
      }
    >
      <button
        ref={faceRef}
        type="button"
        className="pcard-face"
        onClick={handleClick}
        aria-disabled={blocked || undefined}
        title={title}
        aria-label={`${category}: ${value.replace(/[.!?]+$/, "")}. ${title}`}
      >
        <span className="pcard-cat">
          <CatIcon size={15} weight="bold" aria-hidden="true" />
          {category}
        </span>
        <span className="pcard-value">
          {lead && <span className="pcard-lead">{lead} </span>}
          {quote ? <>&ldquo;{value}&rdquo;</> : value}
        </span>
        {meta && <span className="pcard-meta">{meta}</span>}
        <span className="pcard-foot" aria-hidden="true">
          {blocked ? (
            <>
              <ProhibitIcon size={14} weight="bold" />
              Blocked by a lock
            </>
          ) : (
            <>
              <ArrowsClockwiseIcon size={14} weight="bold" />
              Re-roll
            </>
          )}
        </span>
      </button>
      {onToggleLock && (
        <button
          type="button"
          className="pcard-lock"
          onClick={onToggleLock}
          aria-pressed={locked}
          aria-label={`${locked ? 'Unlock' : 'Lock'} ${category.toLowerCase()}`}
          title={locked ? 'Unlock' : 'Lock (survives Deal)'}
        >
          {locked ? (
            <LockSimpleIcon size={16} weight="fill" aria-hidden="true" />
          ) : (
            <LockSimpleOpenIcon size={16} weight="bold" aria-hidden="true" />
          )}
        </button>
      )}
    </motion.div>
  );
}
