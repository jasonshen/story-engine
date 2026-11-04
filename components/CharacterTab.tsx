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

// The character is dealt in four steps: the wound and the belief it left,
// the strategy with its payoff and cost, the four behaviour traits, the arc.
const CHARACTER_STEPS = 4;
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
  // Staged deal: which step is on the table and which cards are face-up.
  const [stage, setStage] = useState(0);
  const [flipped, setFlipped] = useState<Set<CharacterSlot>>(new Set());
  const writingRef = useRef<WritingSectionHandle>(null);

  // Refs so the deal callback always sees current state.
  const stateRef = useRef({ character, pins, intensity });
  useEffect(() => {
    stateRef.current = { character, pins, intensity };
  }, [character, pins, intensity]);

  const handleGenerate = useCallback(() => {
    const { character: prev, pins: p, intensity: i } = stateRef.current;
    const { character: next, pins: nextPins } = generateCharacter(prev, p, i);
    if (prev) setHistory((h) => [...h, prev]);
    setCharacter(next);
    setPins(nextPins);
    setSketchError(null);
    setShuffleKey((k) => k + 1);
    setStage(0);
    // Locked cards carry over face-up; everything else is dealt face-down.
    setFlipped(new Set(nextPins));
    writingRef.current?.reset();
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

  const handleFlip = useCallback((slot: CharacterSlot) => {
    setFlipped((prev) => new Set(prev).add(slot));
  }, []);

  const dealtSlots = character
    ? CHARACTER_SLOTS.filter((s) => CHAR_STAGE[s] <= stage)
    : [];
  const canContinue = dealtSlots.every((s) => flipped.has(s));
  const complete = !!character && stage >= CHARACTER_STEPS - 1 && canContinue;

  const handleContinue = useCallback(() => {
    setStage((s) => Math.min(s + 1, CHARACTER_STEPS - 1));
  }, []);

  // A card's turn in its step's deal, skipping locked cards already on the table.
  const dealTurn = (slot: CharacterSlot) =>
    CHARACTER_SLOTS.slice(0, CHARACTER_SLOTS.indexOf(slot)).filter(
      (s) => CHAR_STAGE[s] === CHAR_STAGE[slot] && !flipped.has(s)
    ).length;

  const card = (slot: CharacterSlot) => {
    if (!character) return null;
    if (CHAR_STAGE[slot] > stage) return null;
    const blocked = !canReroll(character, slot, pins);
    return (
      <PlayCard
        key={`${shuffleKey}-${slot}`}
        category={SLOT_LABELS[slot]}
        icon={SLOT_ICON[slot]}
        value={slotValue(character, slot)}
        variant={SLOT_VARIANT[slot]}
        dealIndex={dealTurn(slot)}
        title={blocked ? blockedTitle(slot) : rerollTitle(slot)}
        blocked={blocked}
        locked={pins.has(slot)}
        onToggleLock={() => togglePin(slot)}
        onReroll={() => handleReroll(slot)}
        randomLabel={() => randomSlotLabel(slot)}
        dealOnMount={!flipped.has(slot)}
        onDealt={() => handleFlip(slot)}
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
              started={!!character}
              complete={complete}
              canContinue={canContinue}
              step={stage}
              steps={CHARACTER_STEPS}
              onDeal={handleGenerate}
              onContinue={handleContinue}
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
                    onClick={() => setIntensity(i)}
                  >
                    {i ? i.charAt(0).toUpperCase() + i.slice(1) : 'Any'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="table-hint">
            Tap a card to re-roll it. Locked cards stay on the table when you deal again.
            Belief and strategy are a pair, so locking one holds the other.
            {pins.size > 0 && (
              <button type="button" className="link-btn" onClick={() => setPins(new Set())}>
                <LockSimpleOpenIcon size={14} weight="bold" aria-hidden="true" />
                Unlock all
              </button>
            )}
          </p>

          {!character ? (
            <EmptyDeck text="Press Deal or G to lay out a character." />
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
                {stage >= 2 && (
                  <div className="behaviors" role="group" aria-label="How they behave">
                    {BEHAVIORS.map((s) => card(s))}
                  </div>
                )}
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
            ready={!!character}
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
