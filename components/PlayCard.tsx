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
  /**
   * This card's turn in its step's deal (0 = first). Cards are dealt one
   * after another, so this sets how long the card waits before dealing.
   */
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
  /** Random label from this card's pool, dealt as a decoy before the real card */
  randomLabel?: () => string;
  /**
   * Whether this card has been asked to deal. Slots start empty; when this
   * turns true the card deals in after its turn (dealIndex). A card that is
   * true from the start (e.g. a locked card carried over) is simply on the
   * table, with no deal.
   */
  dealt?: boolean;
  /** Called once the real card has landed after its deal */
  onDealt?: () => void;
  /** Tapping an empty slot asks for just this card to be dealt */
  onRequestDeal?: () => void;
}

/*
 * Deal choreography. A card is "dealt" into its slot: a decoy slides in from
 * the left and lands, a second decoy slides in over it, then the real card
 * slides in over the top and stays. No rotation. Cards in a step deal one
 * after another, DEAL_STEP apart.
 */
const SLIDE_PX = 56;
const DECOY_IN = 0.16; // s
const DECOY_HOLD = 70; // ms the decoy rests before the next card covers it
const FINAL_IN = 0.26; // s
const DEAL_DECOYS = 2;
const REROLL_DECOYS = 1;
const DEAL_BASE = 180; // ms before the first card of a step
export const DEAL_STEP = 600; // ms between cards in a step
const CASCADE_STEP = 120; // ms between cards changed by a cascade
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const POP_IN = 0.05; // s: just enough fade that a card doesn't blink in

// Each decoy lands a little askew, alternating sides, so the cards dealt
// before the real one read as a loose pile. The real card lands square.
const ANGLE_MIN = 1.0; // deg
const ANGLE_SPREAD = 1.5; // deg
const randomAngle = (side: number) => side * (ANGLE_MIN + Math.random() * ANGLE_SPREAD);

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
  dealt = false,
  onDealt,
  onRequestDeal,
}: PlayCardProps) {
  const reduce = useReducedMotion();
  const [faceRef, animate] = useAnimate<HTMLButtonElement>();

  const valueRef = useRef(value);
  valueRef.current = value;
  const labelRef = useRef(randomLabel);
  labelRef.current = randomLabel;
  const onDealtRef = useRef(onDealt);
  onDealtRef.current = onDealt;

  const prevValue = useRef(value);
  const clicked = useRef(false);
  const runId = useRef(0);
  const alive = useRef(true);
  const mounted = useRef(false);
  const [rollTick, setRollTick] = useState(0);

  // What the top card shows (a decoy mid-deal, or the real value), the card
  // underneath it while the next one slides over, and whether the slot is
  // still empty because this card hasn't been dealt yet.
  const [shown, setShown] = useState(value);
  const [under, setUnder] = useState<string | null>(null);
  const [underAngle, setUnderAngle] = useState(0);
  const [decoy, setDecoy] = useState(false);
  const [pending, setPending] = useState(!dealt);
  const [dealing, setDealing] = useState(false);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      runId.current++;
    };
  }, []);

  /**
   * Deal the current value into the slot, preceded by `decoys` decoy cards.
   * Each new card slides in from the left over the one before it. A newer
   * deal cancels any deal still in progress.
   */
  const slideIn = useCallback(
    (el: HTMLElement, duration: number, overCard: boolean, fromDeg: number, toDeg: number) =>
      Promise.all([
        animate(
          el,
          { x: [-SLIDE_PX, 0], rotate: [fromDeg, toDeg] },
          { duration, ease: EASE_OUT }
        ),
        // Into an empty slot, a short fade so it doesn't pop; over another
        // card, fully solid so the card beneath never shows through.
        animate(el, { opacity: overCard ? 1 : [0, 1] }, { duration: overCard ? 0 : POP_IN }),
      ]),
    [animate]
  );

  const deal = useCallback(
    async (decoys: number, delayMs: number) => {
      const id = ++runId.current;
      const live = () => alive.current && id === runId.current;
      setDealing(true);
      try {
        if (delayMs) await sleep(delayMs);
        const el = faceRef.current;
        if (!live() || !el) return;

        if (reduce) {
          setPending(false);
          setUnder(null);
          setDecoy(false);
          setShown(valueRef.current);
          onDealtRef.current?.();
          await animate(el, { opacity: [0, 1], x: 0, rotate: 0 }, { duration: 0.2 });
          return;
        }

        // What is already in the slot gets covered by the first card in.
        let lying: string | null = pendingRef.current ? null : shownRef.current;
        let lyingAngle = 0;
        let side = Math.random() < 0.5 ? -1 : 1;
        const pick = labelRef.current;
        for (let k = 0; pick && k < decoys; k++) {
          const label = pick();
          const angle = randomAngle(side);
          side = -side;
          setUnder(lying);
          setUnderAngle(lyingAngle);
          setPending(false);
          setDecoy(true);
          setShown(label);
          // Slides in a touch more crooked than where it comes to rest.
          await slideIn(el, DECOY_IN, lying !== null, angle * 1.5, angle);
          if (!live()) return;
          await sleep(DECOY_HOLD);
          if (!live()) return;
          lying = label;
          lyingAngle = angle;
        }

        setUnder(lying);
        setUnderAngle(lyingAngle);
        setPending(false);
        setDecoy(false);
        setShown(valueRef.current);
        // The real card is on its way in: count it as dealt now, so the
        // prose fills in and Continue unlocks without waiting for the settle.
        onDealtRef.current?.();
        await slideIn(el, FINAL_IN, lying !== null, randomAngle(side), 0);
        if (!live()) return;
        setUnder(null);
      } finally {
        if (id === runId.current && alive.current) setDealing(false);
      }
    },
    [reduce, animate, faceRef, slideIn]
  );

  // When this slot is asked to deal, wait for its turn in the batch, then deal.
  useEffect(() => {
    if (!dealt || !pendingRef.current || runId.current !== 0) return;
    deal(DEAL_DECOYS, DEAL_BASE + Math.min(dealIndex, 14) * DEAL_STEP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealt]);

  // Later value changes: a tap on this card re-deals it straight away; a
  // cascade from another card re-deals the changed cards in order.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const changed = prevValue.current !== value;
    prevValue.current = value;
    if (!changed && rollTick === 0) return;
    if (pendingRef.current && runId.current === 0) {
      // Not dealt yet: it will deal the new value when its turn comes.
      setShown(value);
      return;
    }
    const fromTap = clicked.current;
    clicked.current = false;
    deal(REROLL_DECOYS, fromTap ? 0 : Math.min(dealIndex, 14) * CASCADE_STEP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, rollTick]);

  const handleClick = useCallback(() => {
    if (pending) {
      if (!dealt && !dealing) onRequestDeal?.();
      return;
    }
    if (blocked || dealing) return;
    clicked.current = true;
    onReroll();
    setRollTick((t) => t + 1);
  }, [blocked, dealing, pending, dealt, onReroll, onRequestDeal]);

  const tiltSeed = (category + variant).split('').reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const tilt = locked ? 0 : TILTS[tiltSeed % TILTS.length];
  const waiting = pending && !dealt;

  const valueText = (v: string) => (quote ? <>&ldquo;{v}&rdquo;</> : v);

  return (
    <motion.div
      className={`pcard pcard--${variant} ${locked ? 'is-locked' : ''} ${
        blocked ? 'is-blocked' : ''
      } ${onToggleLock ? 'has-lock' : ''} ${pending ? 'is-pending' : ''} ${
        dealing && !pending ? 'is-dealing' : ''
      } ${
        decoy ? 'is-decoy' : ''
      } ${className}`}
      initial={false}
      animate={{ opacity: 1, rotate: tilt }}
      transition={{ duration: 0.2 }}
      whileHover={
        blocked || pending || dealing
          ? undefined
          : { y: -3, transition: { type: 'spring', stiffness: 420, damping: 26 } }
      }
    >
      {pending && (
        <span className="pcard-slot" aria-hidden="true">
          <span className="pcard-slot-cat">
            <CatIcon size={16} weight="bold" aria-hidden="true" />
            {category}
          </span>
          {waiting && <span className="pcard-slot-hint">Tap to deal</span>}
        </span>
      )}
      {under !== null && (
        <div
          className="pcard-face pcard-ghost"
          aria-hidden="true"
          style={{ transform: `rotate(${underAngle}deg)` }}
        >
          <span className="pcard-cat">
            <CatIcon size={15} weight="bold" aria-hidden="true" />
            {category}
          </span>
          <span className="pcard-value">
            {lead && <span className="pcard-lead">{lead} </span>}
            {valueText(under)}
          </span>
        </div>
      )}
      <button
        ref={faceRef}
        type="button"
        className="pcard-face"
        onClick={handleClick}
        aria-disabled={(pending ? dealt : blocked) || undefined}
        aria-busy={dealing || undefined}
        title={pending ? (dealt ? `${category}: being dealt` : 'Deal this card') : title}
        aria-label={
          pending
            ? dealt
              ? `${category}: being dealt`
              : `${category}: not dealt yet. Deal this card`
            : `${category}: ${value.replace(/[.!?]+$/, '')}. ${title}`
        }
      >
        <span className="pcard-cat">
          <CatIcon size={15} weight="bold" aria-hidden="true" />
          {category}
        </span>
        <span className="pcard-value">
          {lead && <span className="pcard-lead">{lead} </span>}
          {valueText(shown)}
        </span>
        {meta && !decoy && <span className="pcard-meta">{meta}</span>}
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
      {onToggleLock && !pending && (
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
