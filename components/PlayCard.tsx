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
  /** Random label from this card's pool, flashed as a decoy during a flip */
  randomLabel?: () => string;
  /**
   * Arrive face-down and turn over in deal order (default). False for cards
   * that should stay put on a new deal, e.g. locked character cards.
   */
  revealOnMount?: boolean;
}

// Deal choreography (ms). Cards arrive face-down, then turn over one at a
// time; each flashes a couple of faded decoys before landing on its value.
const DEAL_BASE = 260;
const DEAL_STEP = 150;
const CASCADE_STEP = 90;
const HALF_OUT = 0.07;
const HALF_IN = 0.08;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  randomLabel,
  revealOnMount = true,
}: PlayCardProps) {
  const reduce = useReducedMotion();
  const [faceRef, animate] = useAnimate<HTMLButtonElement>();
  const prevValue = useRef(value);
  const valueRef = useRef(value);
  valueRef.current = value;
  const labelRef = useRef(randomLabel);
  labelRef.current = randomLabel;
  const busy = useRef(false);
  const clicked = useRef(false);
  const runId = useRef(0);
  const alive = useRef(true);
  const [rollTick, setRollTick] = useState(0);
  const mounted = useRef(false);

  // What the face shows right now: the real value, or a decoy mid-flip.
  const [shown, setShown] = useState(value);
  const [decoy, setDecoy] = useState(false);
  const [faceDown, setFaceDown] = useState(revealOnMount);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      runId.current++;
    };
  }, []);

  /**
   * Turn the card over to its current value, flashing `decoys` random labels
   * on the way. Starting a new run cancels any run still in progress.
   */
  const reveal = useCallback(
    async (decoys: number, delayMs: number) => {
      const id = ++runId.current;
      const live = () => alive.current && id === runId.current;
      busy.current = true;
      try {
        if (delayMs) await sleep(delayMs);
        const el = faceRef.current;
        if (!live() || !el) return;

        if (reduce) {
          setFaceDown(false);
          setDecoy(false);
          setShown(valueRef.current);
          await animate(el, { opacity: [0.25, 1], rotateY: 0 }, { duration: 0.22 });
          return;
        }

        const pick = labelRef.current;
        for (let k = 0; pick && k < decoys; k++) {
          await animate(el, { rotateY: 90 }, { duration: HALF_OUT, ease: [0.5, 0, 1, 1] });
          if (!live()) return;
          setFaceDown(false);
          setDecoy(true);
          setShown(pick());
          await animate(el, { rotateY: [-90, 0] }, { duration: HALF_IN, ease: [0, 0, 0.5, 1] });
          if (!live()) return;
        }
        await animate(el, { rotateY: 90 }, { duration: HALF_OUT, ease: [0.5, 0, 1, 1] });
        if (!live()) return;
        setFaceDown(false);
        setDecoy(false);
        setShown(valueRef.current);
        await animate(
          el,
          { rotateY: [-90, 0] },
          { type: 'spring', stiffness: 320, damping: 24, mass: 0.7 }
        );
      } finally {
        if (id === runId.current) busy.current = false;
      }
    },
    [reduce, animate, faceRef]
  );

  // First appearance: wait for this card's turn in the deal, then flip.
  useEffect(() => {
    if (!revealOnMount) return;
    reveal(2, DEAL_BASE + Math.min(dealIndex, 14) * DEAL_STEP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Later value changes: a tap on this card flips it straight away; a
  // cascade from another card ripples down the spread in deal order.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const changed = prevValue.current !== value;
    prevValue.current = value;
    if (!changed && rollTick === 0) return;
    const fromTap = clicked.current;
    clicked.current = false;
    reveal(1, fromTap ? 0 : Math.min(dealIndex, 14) * CASCADE_STEP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, rollTick]);

  const handleClick = useCallback(async () => {
    if (blocked || busy.current || faceDown) return;
    busy.current = true;
    clicked.current = true;
    const el = faceRef.current;
    try {
      if (el) {
        if (reduce) {
          await animate(el, { opacity: 0.25 }, { duration: 0.12 });
        } else {
          await animate(el, { rotateY: 90 }, { duration: 0.12, ease: [0.5, 0, 1, 1] });
        }
      }
    } finally {
      onReroll();
      setRollTick((t) => t + 1);
    }
  }, [blocked, reduce, animate, faceRef, onReroll, faceDown]);

  const tilt = locked ? 0 : TILTS[dealIndex % TILTS.length];

  return (
    <motion.div
      className={`pcard pcard--${variant} ${locked ? 'is-locked' : ''} ${
        blocked ? 'is-blocked' : ''
      } ${onToggleLock ? 'has-lock' : ''} ${faceDown ? 'is-facedown' : ''} ${
        decoy ? 'is-decoy' : ''
      } ${className}`}
      initial={
        !revealOnMount
          ? false
          : reduce
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
        aria-disabled={blocked || faceDown || undefined}
        aria-busy={faceDown || decoy || undefined}
        title={title}
        aria-label={`${category}: ${value.replace(/[.!?]+$/, "")}. ${title}`}
      >
        <span className="pcard-cat">
          <CatIcon size={15} weight="bold" aria-hidden="true" />
          {category}
        </span>
        <span className="pcard-value">
          {lead && <span className="pcard-lead">{lead} </span>}
          {quote ? <>&ldquo;{shown}&rdquo;</> : shown}
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
