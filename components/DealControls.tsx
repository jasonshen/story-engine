'use client';

import DealButton from './DealButton';

interface DealControlsProps {
  /** A deal is on the table */
  started: boolean;
  /** Every step has been dealt and every card turned over */
  complete: boolean;
  /** Every card dealt so far is face-up */
  canContinue: boolean;
  /** Zero-based current step, and the total number of steps */
  step: number;
  steps: number;
  onDeal: () => void;
  onContinue: () => void;
  /** Only the visible tab listens for the keyboard shortcut */
  active: boolean;
}

/**
 * The deal is revealed in steps. Deal lays out the first step face-down;
 * once every card on the table is turned over, Continue deals the next.
 * Start Over throws the whole deal away and begins again.
 */
export default function DealControls({
  started,
  complete,
  canContinue,
  step,
  steps,
  onDeal,
  onContinue,
  active,
}: DealControlsProps) {
  const midDeal = started && !complete;

  return (
    <div className="deal-controls">
      <DealButton
        label={midDeal ? 'Continue' : 'Deal'}
        onDeal={midDeal ? onContinue : onDeal}
        disabled={midDeal && !canContinue}
        active={active}
      />
      {midDeal && (
        <div className="deal-aside">
          <span className="deal-step">
            Step {step + 1} of {steps}
          </span>
          <span className="deal-aside-row">
            <span>
              or{' '}
              <button type="button" className="link-btn link-btn--plain" onClick={onDeal}>
                Start Over
              </button>
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
