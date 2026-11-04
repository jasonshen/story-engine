'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import HoldToGenerate from './HoldToGenerate';
import WritingSection, { WritingSectionHandle } from './WritingSection';

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

const LockIcon = ({ locked }: { locked: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="5" y="11" width="14" height="10" rx="2" />
    {locked ? <path d="M8 11V7a4 4 0 0 1 8 0v4" /> : <path d="M8 11V7a4 4 0 0 1 7.5-2" />}
  </svg>
);

interface CharacterTabProps {
  onEntrySaved: (entry: WritingEntry) => void;
}

export default function CharacterTab({ onEntrySaved }: CharacterTabProps) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [pins, setPins] = useState<Set<CharacterSlot>>(new Set());
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [history, setHistory] = useState<Character[]>([]);
  const [sketchLoading, setSketchLoading] = useState(false);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const [shuffleKey, setShuffleKey] = useState(0);
  const writingRef = useRef<WritingSectionHandle>(null);

  // Refs so the hold-to-generate callback always sees current state.
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
    }) => {
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
          id: entryData.id,
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

  const el = (slot: CharacterSlot) =>
    character && (
      <ClickableElement
        text={slotValue(character, slot)}
        className={`${SLOT_CLASS[slot]} ${pins.has(slot) ? 'el-pinned' : ''}`}
        onReroll={() => handleReroll(slot)}
        title={`Re-roll ${SLOT_LABELS[slot].toLowerCase()}${
          slot === 'wound' || slot === 'belief' || slot === 'strategy'
            ? ' (cascades down)'
            : ''
        }`}
        randomLabel={() => randomSlotLabel(slot)}
        shuffleKey={shuffleKey}
        shuffleDuration={SLOT_DURATION[slot]}
      />
    );

  return (
    <>
      <div className="controls controls-stack">
        <HoldToGenerate onGenerate={handleGenerate} />
        <div className="opening-section filter-section">
          <div className="opening-label">Wound weight</div>
          <div className="opening-pills">
            {INTENSITIES.map((i) => (
              <button
                key={i ?? 'any'}
                type="button"
                className={`pill ${intensity === i ? 'selected' : ''}`}
                onClick={() => setIntensity(i)}
              >
                {i ? i.charAt(0).toUpperCase() + i.slice(1) : 'Any'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="concept">
        {!character ? (
          <div className="concept-empty">
            <span className="glyph">&#x2727;</span>
            Press generate to conjure a character
          </div>
        ) : (
          <div className="concept-enter character-profile">
            <div className="character-origin">
              After {el('wound')}, they came to believe:
            </div>
            <div className="character-belief">
              &ldquo;{el('belief')}&rdquo;
            </div>
            <div className="character-origin">
              So they {el('strategy')}. It buys them {el('payoff')}, but costs
              them {el('cost')}.
            </div>

            <hr className="concept-divider" />

            <div className="backstory-block">
              <div className="backstory-sentence">
                On an ordinary day they&rsquo;re {el('coping')}. When they want
                something, they turn {el('negotiating')}. When the wound gets
                poked, they go {el('conflict')}. But when the armor slips,
                they&rsquo;re {el('wildcard')}.
              </div>
            </div>

            <div className="character-arc">
              Their arc: learning that {el('lesson')}.
            </div>

            {/* Sketch */}
            {sketchLoading && (
              <div className="narrative">
                <div className="narrative-text narrative-loading">
                  Sketching character...
                </div>
              </div>
            )}
            {!sketchLoading && character.sketch && (
              <div className="narrative">
                <div className="narrative-text">{character.sketch}</div>
              </div>
            )}
            {!sketchLoading && !character.sketch && (
              <div className="narrative-action">
                <button
                  className="btn btn-narrative"
                  onClick={handleSketch}
                  type="button"
                >
                  Create Sketch
                </button>
                {sketchError && <div className="sketch-error">{sketchError}</div>}
              </div>
            )}

            <Anatomy
              character={character}
              pins={pins}
              onTogglePin={togglePin}
              onClearPins={() => setPins(new Set())}
            />
          </div>
        )}
      </div>

      <WritingSection
        ref={writingRef}
        ready={!!character}
        onSave={handleSave}
        prompt="Now write a scene that reveals them..."
        placeholder="Show the strategy working, then show it cost them..."
      />

      <div className="history">
        <hr className="history-rule" />
        <div className="history-title">Previous characters</div>
        {history.length === 0 ? (
          <div className="history-empty">
            Characters will collect here as you generate.
          </div>
        ) : (
          [...history].reverse().map((c, idx) => (
            <div key={`${c.id}-${idx}`} className="history-item">
              <div className="history-num">No. {history.length - idx}</div>
              <div className="history-logline">{characterText(c)}</div>
              {c.sketch && <div className="history-narr">{c.sketch}</div>}
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ---------- anatomy panel: the graph behind the prose, with locks ----------

function slotMeta(c: Character, slot: CharacterSlot): string | null {
  const s = strategyOf(c);
  switch (slot) {
    case 'wound':
      return woundOf(c).intensity;
    case 'belief':
      return `about ${beliefOf(c).locus}`;
    case 'strategy':
      return `${s.inspiredBy} · ${s.stance} (${GRAPH.enums.stance[s.stance]}) · ${s.outlook} (${GRAPH.enums.outlook[s.outlook]}) · fears ${s.fear}, wants ${s.desire}`;
    case 'conflict':
      return `${c.conflict.mode}: ${GRAPH.enums.conflictMode[c.conflict.mode]}`;
    default:
      return null;
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
    <div className="anatomy">
      <div className="anatomy-head">
        <div className="anatomy-title">Anatomy</div>
        <div className="anatomy-hint">
          Lock what you like; Generate re-rolls everything else around it.
          {pins.size > 0 && (
            <>
              {' '}
              <button type="button" className="anatomy-clear" onClick={onClearPins}>
                Unlock all
              </button>
            </>
          )}
        </div>
      </div>
      {CHARACTER_SLOTS.map((slot) => {
        const locked = pins.has(slot);
        const meta = slotMeta(character, slot);
        return (
          <div key={slot} className={`anatomy-row ${locked ? 'locked' : ''}`}>
            <button
              type="button"
              className="anatomy-lock"
              onClick={() => onTogglePin(slot)}
              aria-pressed={locked}
              title={locked ? 'Unlock' : 'Lock (survives Generate)'}
            >
              <LockIcon locked={locked} />
            </button>
            <div className="anatomy-label">{SLOT_LABELS[slot]}</div>
            <div className="anatomy-value">
              {slotValue(character, slot)}
              {meta && <div className="anatomy-meta">{meta}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
