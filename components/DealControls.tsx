'use client';

import DealButton from './DealButton';

interface DealControlsProps {
  /** Some card of this deal has been dealt (or asked for) */
  started: boolean;
  /** Every card of this deal is on the table */
  complete: boolean;
  /** Cards are sliding in right now */
  dealing: boolean;
  /** Name of the group the button deals next, e.g. "Drive and object" */
  nextName: string | null;
  dealtCount: number;
  total: number;
  /** Deal the next group */
  onDealNext: () => void;
  /** Throw this deal away and lay out a fresh, empty table */
  onNewDeal: () => void;
  /** Only the visible tab listens for the keyboard shortcut */
  active: boolean;
}

/**
 * The whole deal is laid out as empty slots up front. The button deals the
 * next group (Deal, then Continue); any single slot can also be tapped to
 * deal just that card. Once everything is on the table the button starts a
 * new deal. Start Over throws away a deal in progress.
 */
export default function DealControls({
  started,
  complete,
  dealing,
  nextName,
  dealtCount,
  total,
  onDealNext,
  onNewDeal,
  active,
}: DealControlsProps) {
  const label = complete ? 'New deal' : started ? 'Continue' : 'Deal';

  return (
    <div className="deal-controls">
      <DealButton
        label={label}
        onDeal={complete ? onNewDeal : onDealNext}
        disabled={dealing}
        active={active}
      />
      <div className="deal-aside">
        <span className="deal-step">
          {complete ? `All ${total} cards dealt` : nextName ? `Next up: ${nextName}` : 'Dealing'}
        </span>
        <span className="deal-aside-row">
          {!complete && (
            <span>
              {dealtCount} of {total} dealt
              {started && (
                <>
                  , or{' '}
                  <button type="button" className="link-btn link-btn--plain" onClick={onNewDeal}>
                    Start Over
                  </button>
                </>
              )}
            </span>
          )}
          {complete && <span>Tap any card to re-roll it.</span>}
        </span>
      </div>
    </div>
  );
}
