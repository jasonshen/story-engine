'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Lock, LockOpen } from '@phosphor-icons/react';
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
  generateCharacter,
  randomSlotLabel,
  rerollSlot,
  slotValue,
  strategyOf,
  woundOf,
} from '@/lib/character-engine';
import { WritingEntry } from '@/lib/types';
import ClickableElement from './ClickableElement';
import { useWriting, WritingSheet, WritingTools, SavePayload } from './WritingSection';
import Workspace, { GenerateButton } from './Workspace';
import { EmptyPage, Expansion, RerollHint } from './ConceptDisplay';
import KeysList from './KeysList';

const SLOT_CLASS: Record<CharacterSlot, string> = {
  wound: 'el-wound',
  belief: 'el-belief',
  strategy: 'el-engine',
  payoff: 'el-anchor',
  cost: 'el-bs-conflict',
  coping: 'el-aspect',
  negotiating: 'el-aspect',
  conflict: 'el-aspect',
  wildcard: 'el-aspect',
  lesson: 'el-lesson',
};

// Staggered landing on Generate, top of the chain first.
const SLOT_DURATION: Record<CharacterSlot, number> = {
  wound: 500,
  belief: 650,
  strategy: 750,
  payoff: 850,
  cost: 900,
  coping: 950,
  negotiating: 1000,
  conflict: 1050,
  wildcard: 1100,
  lesson: 1200,
};

const INTENSITIES: (Intensity | null)[] = [null, ...GRAPH.enums.intensity];

/** Digit shortcut per slot, in template order: 1..9 then 0 */
const SLOT_KEY: Record<CharacterSlot, string> = Object.fromEntries(
  CHARACTER_SLOTS.map((slot, i) => [slot, String((i + 1) % 10)])
) as Record<CharacterSlot, string>;

export interface CharacterTabHandle {
  generate: () => void;
}

interface CharacterTabProps {
  onEntrySaved: (entry: WritingEntry) => void;
  /** Receives the outgoing character each time a new one is generated */
  onArchive: (previous: Character) => void;
}

const CharacterTab = forwardRef<CharacterTabHandle, CharacterTabProps>(function CharacterTab(
  { onEntrySaved, onArchive },
  ref
) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [pins, setPins] = useState<Set<CharacterSlot>>(new Set());
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [sketchLoading, setSketchLoading] = useState(false);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const [shuffleKey, setShuffleKey] = useState(0);
  const w = useWriting();
  const resetWriting = w.reset;

  // Refs so the hold-to-generate callback always sees current state.
  const stateRef = useRef({ character, pins, intensity });
  useEffect(() => {
    stateRef.current = { character, pins, intensity };
  }, [character, pins, intensity]);

  const handleGenerate = useCallback(() => {
    const { character: prev, pins: p, intensity: i } = stateRef.current;
    const { character: next, pins: nextPins } = generateCharacter(prev, p, i);
    if (prev) onArchive(prev);
    setCharacter(next);
    setPins(nextPins);
    setSketchError(null);
    setShuffleKey((k) => k + 1);
    resetWriting();
  }, [onArchive, resetWriting]);

  useImperativeHandle(ref, () => ({ generate: handleGenerate }), [handleGenerate]);

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
    async (data: SavePayload) => {
      const c = stateRef.current.character;
      if (!c) return;
      const summary = characterSummaryHTML(c);
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

        onEntrySaved({
          // Without a database the API returns no id; keep the entry usable locally.
          id: entryData.id ?? `local-${Date.now()}`,
          concept_id: conceptData.id,
          concept_summary: summary,
          opening_style: data.opening_style,
          body: data.body,
          word_count: data.word_count,
          duration_seconds: data.duration_seconds,
          created_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Save failed:', error);
      }
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

  const el = (slot: CharacterSlot) => {
    if (!character) return null;
    const blocked = !canReroll(character, slot, pins);
    return (
      <ClickableElement
        text={slotValue(character, slot)}
        className={`${SLOT_CLASS[slot]} ${pins.has(slot) ? 'el-pinned' : ''}`}
        onReroll={() => handleReroll(slot)}
        title={blocked ? blockedTitle(slot) : rerollTitle(slot)}
        randomLabel={() => randomSlotLabel(slot)}
        shuffleKey={shuffleKey}
        shuffleDuration={SLOT_DURATION[slot]}
        disabled={blocked}
        hotkey={SLOT_KEY[slot]}
      />
    );
  };

  const tools = (
    <>
      <div className="tool tool-generate">
        <GenerateButton onGenerate={handleGenerate} rollKey={shuffleKey} />
      </div>
      <div className="tool">
        <div className="tool-label" id="wound-weight-label">
          Wound weight
        </div>
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
      {character ? (
        <Anatomy
          character={character}
          pins={pins}
          onTogglePin={togglePin}
          onClearPins={() => setPins(new Set())}
        />
      ) : (
        <KeysList compact tab="character" />
      )}
      <WritingTools w={w} ready={!!character} />
    </>
  );

  const prompt = !character ? (
    <EmptyPage noun="character" />
  ) : (
    <div className="prompt concept-enter character-profile">
      <p className="character-origin">
        After {el('wound')}, they came to believe:
      </p>
      <p className="character-belief">
        <span className="quote-open" aria-hidden="true">&ldquo;</span>
        {el('belief')}&rdquo;
      </p>
      <p className="character-origin">
        So they {el('strategy')}. It buys them {el('payoff')}, but costs them{' '}
        {el('cost')}.
      </p>

      <p className="backstory">
        On an ordinary day they&rsquo;re {el('coping')}. When they want something, they
        turn {el('negotiating')}. When the wound gets poked, they go {el('conflict')}. But
        when the armor slips, they&rsquo;re {el('wildcard')}.
      </p>

      <p className="character-arc">Their arc: learning that {el('lesson')}.</p>

      <RerollHint />

      <Expansion
        loading={sketchLoading}
        text={character.sketch}
        error={sketchError}
        onCreate={handleSketch}
        label="Create Sketch"
        loadingLabel="Sketching character..."
      />
    </div>
  );

  return (
    <Workspace
      toolsLabel="Character tools"
      prompt={prompt}
      writing={
        <WritingSheet
          w={w}
          ready={!!character}
          onSave={handleSave}
          prompt="Now write a scene that reveals them..."
          placeholder="Show the strategy working, then show it cost them..."
        />
      }
      tools={tools}
    />
  );
});

export default CharacterTab;

// ---------- anatomy panel: the graph behind the prose, with locks ----------

function slotMeta(c: Character, slot: CharacterSlot): string[] {
  const s = strategyOf(c);
  switch (slot) {
    case 'wound':
      return [woundOf(c).intensity];
    case 'belief':
      return [`about ${beliefOf(c).locus}`];
    case 'strategy':
      return [
        s.inspiredBy,
        `${s.stance} (${GRAPH.enums.stance[s.stance]}), ${s.outlook} (${GRAPH.enums.outlook[s.outlook]})`,
        `fears ${s.fear}, wants ${s.desire}`,
      ];
    case 'conflict':
      return [`${c.conflict.mode}: ${GRAPH.enums.conflictMode[c.conflict.mode]}`];
    default:
      return [];
  }
}

interface AnatomyProps {
  character: Character;
  pins: Set<CharacterSlot>;
  onTogglePin: (slot: CharacterSlot) => void;
  onClearPins: () => void;
}

function Anatomy({ character, pins, onTogglePin, onClearPins }: AnatomyProps) {
  return (
    <div className="tool anatomy">
      <div className="tool-label-row">
        <div className="tool-label">Anatomy</div>
        {pins.size > 0 && (
          <button type="button" className="text-btn" onClick={onClearPins}>
            Unlock all
          </button>
        )}
      </div>
      <p className="tool-note">
        Lock what you like; Generate re-rolls everything else around it. Belief and strategy
        are a pair, so locking one holds the other.
      </p>
      <ol className="anatomy-list">
        {CHARACTER_SLOTS.map((slot) => {
          const locked = pins.has(slot);
          const held =
            !locked &&
            slot === 'strategy' &&
            (['belief', 'payoff', 'cost'] as CharacterSlot[]).some((s) => pins.has(s));
          const blocked = !locked && !canReroll(character, slot, pins);
          const meta = slotMeta(character, slot);
          return (
            <li key={slot} className={`anatomy-row ${locked ? 'locked' : ''}`}>
              <span className="anatomy-num" aria-hidden="true">
                {SLOT_KEY[slot]}
              </span>
              <div className="anatomy-body">
                <div className="anatomy-label">
                  {SLOT_LABELS[slot]}
                  {blocked && <span className="anatomy-flag">blocked by a lock</span>}
                </div>
                <div className="anatomy-value" title={slotValue(character, slot)}>
                  {slotValue(character, slot)}
                </div>
                {meta.map((m) => (
                  <div key={m} className="anatomy-meta">
                    {m}
                  </div>
                ))}
                {held && <div className="anatomy-meta anatomy-held">held by the locked belief</div>}
              </div>
              <button
                type="button"
                className="icon-btn anatomy-lock"
                data-lock-key={SLOT_KEY[slot]}
                onClick={() => onTogglePin(slot)}
                aria-pressed={locked}
                aria-label={`${locked ? 'Unlock' : 'Lock'} ${SLOT_LABELS[slot].toLowerCase()}`}
                title={locked ? 'Unlock' : 'Lock (survives Generate)'}
              >
                {locked ? (
                  <Lock weight="fill" aria-hidden="true" />
                ) : (
                  <LockOpen aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
