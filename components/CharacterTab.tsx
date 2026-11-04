'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CoinsIcon,
  FireIcon,
  HandshakeIcon,
  HeartBreakIcon,
  LockSimpleOpenIcon,
  PathIcon,
  PenNibIcon,
  QuotesIcon,
  ReceiptIcon,
  ShieldSlashIcon,
  StrategyIcon,
  SunIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import {
  Character,
  CharacterSlot,
  CHARACTER_SLOTS,
  Intensity,
  SLOT_LABELS,
} from '@/lib/character-types';
import {
  GRAPH,
  beliefOf,
  canReroll,
  characterElements,
  characterSummaryHTML,
  characterText,
  generateCharacter,
  randomSlotLabel,
  rerollSlot,
  slotValue,
  strategyOf,
  woundOf,
} from '@/lib/character-engine';
import { WritingEntry } from '@/lib/types';
import ClickableElement from './ClickableElement';
import DealControls from './DealControls';
import { dealProgress, useDealQueue } from './useDealQueue';
import Drawer from './Drawer';
import EmptyDeck from './EmptyDeck';
import NarrativeBlock from './NarrativeBlock';
import PlayCard from './PlayCard';
import WritingSection, { SaveResult, WritingSectionHandle } from './WritingSection';

const SLOT_ICON: Record<CharacterSlot, Icon> = {
  wound: HeartBreakIcon,
  belief: QuotesIcon,
  strategy: StrategyIcon,
  payoff: CoinsIcon,
  cost: ReceiptIcon,
  coping: SunIcon,
  negotiating: HandshakeIcon,
  conflict: FireIcon,
  wildcard: ShieldSlashIcon,
  lesson: PathIcon,
};

const SLOT_VARIANT: Record<CharacterSlot, string> = {
  wound: 'wound',
  belief: 'belief',
  strategy: 'strategy',
  payoff: 'payoff',
  cost: 'cost',
  coping: 'behavior',
  negotiating: 'behavior',
  conflict: 'behavior',
  wildcard: 'behavior',
  lesson: 'arc',
};

const INTENSITIES: (Intensity | null)[] = [null, ...GRAPH.enums.intensity];
const BEHAVIORS: CharacterSlot[] = ['coping', 'negotiating', 'conflict', 'wildcard'];

interface CharacterTabProps {
  onEntrySaved: (entry: WritingEntry) => void;
  /** Whether this tab is visible (it owns the G shortcut while it is) */
  active: boolean;
  /** The shared saved-entries drawer */
  savedEntries: React.ReactNode;
}

// The character is dealt in four groups: the wound and the belief it left,
// the strategy with its payoff and cost, the four behaviour traits, the arc.
const CHARACTER_GROUPS = [
  'Wound and belief',
  'Strategy, payoff and cost',
  'How they behave',
  'Arc',
];
const CHAR_STAGE: Record<CharacterSlot, number> = {
  wound: 0,
  belief: 0,
  strategy: 1,
  payoff: 1,
  cost: 1,
  coping: 2,
  negotiating: 2,
  conflict: 2,
  wildcard: 2,
  lesson: 3,
};

export default function CharacterTab({ onEntrySaved, active, savedEntries }: CharacterTabProps) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [pins, setPins] = useState<Set<CharacterSlot>>(new Set());
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [history, setHistory] = useState<Character[]>([]);
  const [sketchLoading, setSketchLoading] = useState(false);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const [shuffleKey, setShuffleKey] = useState(0);
  // The whole character is laid out as empty slots; cards deal in by group
  // or one at a time when their slot is tapped.
  const deal = useDealQueue<CharacterSlot>();
  const dealRef = useRef(deal);
  dealRef.current = deal;
  const writingRef = useRef<WritingSectionHandle>(null);

  // Refs so the deal callback always sees current state.
  const stateRef = useRef({ character, pins, intensity });
  useEffect(() => {
    stateRef.current = { character, pins, intensity };
  }, [character, pins, intensity]);

  /** Lay out a fresh table. Locked cards carry over; the rest start empty. */
  const handleGenerate = useCallback((intensityOverride?: Intensity | null) => {
    const { character: prev, pins: p, intensity: i } = stateRef.current;
    const weight = intensityOverride === undefined ? i : intensityOverride;
    const { character: next, pins: nextPins } = generateCharacter(prev, p, weight);
    const { landed, carried } = dealRef.current;
    // Keep it in the history only if any of it was actually dealt this time.
    if (prev && Array.from(landed).some((s) => !carried.has(s))) setHistory((h) => [...h, prev]);
    setCharacter(next);
    setPins(nextPins);
    setSketchError(null);
    setShuffleKey((k) => k + 1);
    dealRef.current.reset(Array.from(nextPins));
    writingRef.current?.reset();
  }, []);

  // Shuffle the first character on load (client-side, random per visit).
  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReroll = useCallback((slot: CharacterSlot) => {
    const { character: c, pins: p, intensity: i } = stateRef.current;
    if (!c) return;
    const { character: next, pins: nextPins } = rerollSlot(c, slot, p, i);
    setCharacter(next);
    setPins(nextPins);
    setSketchError(null);
  }, []);

  const togglePin = useCallback((slot: CharacterSlot) => {
    setPins((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }, []);

  const handleSketch = useCallback(async () => {
    const c = stateRef.current.character;
    if (!c || c.sketch || sketchLoading) return;
    setSketchLoading(true);
    setSketchError(null);
    try {
      const res = await fetch('/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements: characterElements(c) }),
      });
      const data = await res.json();
      if (data.sketch) {
        setCharacter((prev) =>
          prev && prev.id === c.id ? { ...prev, sketch: data.sketch } : prev
        );
      } else {
        setSketchError(data.error || 'Sketch failed.');
      }
    } catch {
      setSketchError('Sketch engine unavailable.');
    } finally {
      setSketchLoading(false);
    }
  }, [sketchLoading]);

  const handleSave = useCallback(
    async (data: {
      opening_style: string | null;
      body: string;
      word_count: number;
      duration_seconds: number | null;
    }): Promise<SaveResult> => {
      const c = stateRef.current.character;
      if (!c) return 'local';
      const summary = characterSummaryHTML(c);
      let conceptId: string | null = null;
      let entryId: string | undefined;
      let ok = false;
      try {
        // Character goes in saved_concepts too, tagged so it can be told apart.
        const conceptRes = await fetch('/api/concepts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            concept_data: { kind: 'character', ...c },
            summary_text: summary,
            narrative: c.sketch,
          }),
        });
        const conceptData = await conceptRes.json();
        conceptId = conceptData.id ?? null;

        const entryRes = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            concept_id: conceptData.id,
            concept_summary: summary,
            ...data,
          }),
        });
        const entryData = await entryRes.json();
        entryId = entryData.id;
        ok = conceptRes.ok && entryRes.ok && !!entryId;
      } catch (error) {
        console.error('Save failed:', error);
      }

      onEntrySaved({
        id: entryId ?? `local-${Date.now()}`,
        concept_id: conceptId,
        concept_summary: summary,
        opening_style: data.opening_style,
        body: data.body,
        word_count: data.word_count,
        duration_seconds: data.duration_seconds,
        created_at: new Date().toISOString(),
      });
      return ok ? 'saved' : 'local';
    },
    [onEntrySaved]
  );

  const rerollTitle = (slot: CharacterSlot): string => {
    switch (slot) {
      case 'wound':
        return 'Re-roll wound (re-rolls everything below it)';
      case 'belief':
        return 'Re-roll belief (keeps the wound; strategy and traits follow)';
      case 'strategy':
        return 'Re-roll strategy (changes the belief too; each belief implies one strategy)';
      default:
        return `Re-roll ${SLOT_LABELS[slot].toLowerCase()}`;
    }
  };

  const blockedTitle = (slot: CharacterSlot): string => {
    const locks = CHARACTER_SLOTS.filter((s) => s !== slot && pins.has(s))
      .map((s) => SLOT_LABELS[s])
      .join(', ');
    return `Locked: re-rolling this would change a locked element (${locks}). Unlock to re-roll.`;
  };

  const slotMeta = (c: Character, slot: CharacterSlot): React.ReactNode => {
    switch (slot) {
      case 'wound':
        return <span className="chip">{woundOf(c).intensity}</span>;
      case 'belief':
        return `about ${beliefOf(c).locus}`;
      case 'strategy': {
        const held =
          !pins.has('strategy') &&
          (['belief', 'payoff', 'cost'] as CharacterSlot[]).some((s) => pins.has(s));
        return (
          <>
            {strategyOf(c).inspiredBy}
            {held && <span className="meta-held">Held by the locked belief</span>}
          </>
        );
      }
      case 'conflict':
        return c.conflict.mode;
      default:
        return null;
    }
  };

  const progress = dealProgress(
    character ? CHARACTER_SLOTS : [],
    (s: CharacterSlot) => CHAR_STAGE[s],
    CHARACTER_GROUPS,
    deal.queued,
    deal.landed,
    deal.carried
  );
  const complete = progress.complete;
  const flipped = deal.landed;
  const nextKeysRef = useRef(progress.nextKeys);
  nextKeysRef.current = progress.nextKeys;

  const handleDealNext = useCallback(() => {
    dealRef.current.queue(nextKeysRef.current);
  }, []);

  // Changing the wound weight before anything is dealt reshuffles the
  // (still hidden) layout so the filter applies to this deal.
  const startedRef = useRef(progress.started);
  startedRef.current = progress.started;
  const chooseIntensity = useCallback(
    (i: Intensity | null) => {
      setIntensity(i);
      if (!startedRef.current) handleGenerate(i);
    },
    [handleGenerate]
  );

  const card = (slot: CharacterSlot) => {
    if (!character) return null;
    const blocked = !canReroll(character, slot, pins);
    return (
      <PlayCard
        key={`${shuffleKey}-${slot}`}
        category={SLOT_LABELS[slot]}
        icon={SLOT_ICON[slot]}
        value={slotValue(character, slot)}
        variant={SLOT_VARIANT[slot]}
        dealIndex={deal.queued.get(slot) ?? 0}
        title={blocked ? blockedTitle(slot) : rerollTitle(slot)}
        blocked={blocked}
        locked={pins.has(slot)}
        onToggleLock={() => togglePin(slot)}
        onReroll={() => handleReroll(slot)}
        randomLabel={() => randomSlotLabel(slot)}
        dealt={deal.queued.has(slot)}
        onDealt={() => deal.land(slot)}
        onRequestDeal={() => deal.queue([slot])}
        quote={slot === 'belief'}
        lead={slot === 'lesson' ? 'Learning that' : undefined}
        meta={slotMeta(character, slot)}
      />
    );
  };

  // Words in the prose summary stay re-rollable too.
  const el = (slot: CharacterSlot) => {
    if (!character) return null;
    if (!flipped.has(slot)) {
      return <span className="blank" role="img" aria-label="Not turned over yet" />;
    }
    const blocked = !canReroll(character, slot, pins);
    return (
      <ClickableElement
        text={slotValue(character, slot)}
        className={`el-${slot} ${pins.has(slot) ? 'el-pinned' : ''}`}
        onReroll={() => handleReroll(slot)}
        title={blocked ? blockedTitle(slot) : rerollTitle(slot)}
        disabled={blocked}
      />
    );
  };

  return (
    <>
      <div className="board">
        <div className="table">
          <div className="deal-bar">
            <DealControls
              started={progress.started}
              complete={progress.complete}
              dealing={progress.dealing}
              nextName={progress.nextName}
              dealtCount={progress.dealtCount}
              total={progress.total}
              onDealNext={handleDealNext}
              onNewDeal={() => handleGenerate()}
              active={active}
            />
            <div className="field field--inline">
              <span className="field-label" id="wound-weight-label">
                Wound weight
              </span>
              <div className="segmented" role="group" aria-labelledby="wound-weight-label">
                {INTENSITIES.map((i) => (
                  <button
                    key={i ?? 'any'}
                    type="button"
                    className={`seg ${intensity === i ? 'selected' : ''}`}
                    aria-pressed={intensity === i}
                    onClick={() => chooseIntensity(i)}
                  >
                    {i ? i.charAt(0).toUpperCase() + i.slice(1) : 'Any'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="table-hint">
            Tap an empty slot to deal just that card, or a dealt card to re-roll it. Locked
            cards stay on the table when you deal again.
            Belief and strategy are a pair, so locking one holds the other.
            {pins.size > 0 && (
              <button type="button" className="link-btn" onClick={() => setPins(new Set())}>
                <LockSimpleOpenIcon size={14} weight="bold" aria-hidden="true" />
                Unlock all
              </button>
            )}
          </p>

          {!character ? (
            <EmptyDeck text="Shuffling the deck..." />
          ) : (
            <>
              <div className="prose prose--character">
                <p>
                  After {el('wound')}, they came to believe: &ldquo;{el('belief')}&rdquo; So
                  they {el('strategy')}. It buys them {el('payoff')}, but costs them{' '}
                  {el('cost')}.
                </p>
                <p>
                  On an ordinary day they&rsquo;re {el('coping')}. When they want something,
                  they turn {el('negotiating')}. When the wound gets poked, they go{' '}
                  {el('conflict')}. But when the armor slips, they&rsquo;re {el('wildcard')}.
                </p>
                <p>Their arc: learning that {el('lesson')}.</p>
              </div>

              <div className="spread spread--character">
                {card('wound')}
                {card('belief')}
                {card('strategy')}
                {card('payoff')}
                {card('cost')}
                <div className="behaviors" role="group" aria-label="How they behave">
                  {BEHAVIORS.map((s) => card(s))}
                </div>
                {card('lesson')}
              </div>

              {complete && (
              <>
              <NarrativeBlock
                text={character.sketch}
                loading={sketchLoading}
                loadingText="Sketching character..."
                error={sketchError}
                buttonLabel="Create Sketch"
                icon={PenNibIcon}
                onCreate={handleSketch}
              />

              <Drawer title="Anatomy">
                <Anatomy character={character} />
              </Drawer>
              </>
              )}
            </>
          )}
        </div>

        <aside className="pad" aria-label="Writing pad">
          <WritingSection
            ref={writingRef}
            ready={progress.dealtCount > 0}
            onSave={handleSave}
            prompt="Now write a scene that reveals them..."
            placeholder="Show the strategy working, then show it cost them..."
            emptyText="Deal a character, then write a scene that reveals them."
          />
        </aside>
      </div>

      <div className="drawers">
        {savedEntries}
        <Drawer title="Previous characters" count={history.length}>
          {history.length === 0 ? (
            <p className="drawer-empty">Characters will collect here as you deal.</p>
          ) : (
            <ol className="history-list">
              {[...history].reverse().map((c, idx) => (
                <li key={`${c.id}-${idx}`} className="history-item">
                  <span className="history-num">No. {history.length - idx}</span>
                  <span className="history-logline">{characterText(c)}</span>
                  {c.sketch && <span className="history-narr">{c.sketch}</span>}
                </li>
              ))}
            </ol>
          )}
        </Drawer>
      </div>
    </>
  );
}

// ---------- anatomy: the graph behind the cards ----------

function Anatomy({ character }: { character: Character }) {
  const w = woundOf(character);
  const b = beliefOf(character);
  const s = strategyOf(character);
  const mode = character.conflict.mode;
  return (
    <dl className="anatomy">
      <div>
        <dt>Wound</dt>
        <dd>{w.intensity}</dd>
      </div>
      <div>
        <dt>Belief</dt>
        <dd>about {b.locus}</dd>
      </div>
      <div className="anatomy-wide">
        <dt>Strategy</dt>
        <dd>
          {s.inspiredBy}. Stance: {s.stance} ({GRAPH.enums.stance[s.stance]}). Outlook:{' '}
          {s.outlook} ({GRAPH.enums.outlook[s.outlook]}). Fears {s.fear}, wants {s.desire}.
        </dd>
      </div>
      <div className="anatomy-wide">
        <dt>Wound poked</dt>
        <dd>
          {mode}: {GRAPH.enums.conflictMode[mode]}
        </dd>
      </div>
    </dl>
  );
}
