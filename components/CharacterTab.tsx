'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CaretRight,
  Feather,
  Info,
  LockSimple,
  LockSimpleOpen,
  UserCircle,
  Warning,
} from '@phosphor-icons/react';
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
import GenerateButton from './GenerateButton';
import WritingSection, { WritingSectionHandle } from './WritingSection';

const SLOT_CLASS: Record<CharacterSlot, string> = {
  wound: 'el-wound',
  belief: 'el-belief',
  strategy: 'el-strategy',
  payoff: 'el-payoff',
  cost: 'el-cost',
  coping: 'el-trait',
  negotiating: 'el-trait',
  conflict: 'el-trait',
  wildcard: 'el-trait',
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

interface CharacterTabProps {
  onEntrySaved: (entry: WritingEntry) => void;
  /** The previous character, handed up when a new one is generated */
  onArchive: (c: Character) => void;
  /** True while this tab is visible, so G generates here */
  active: boolean;
}

export default function CharacterTab({ onEntrySaved, onArchive, active }: CharacterTabProps) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [pins, setPins] = useState<Set<CharacterSlot>>(new Set());
  const [intensity, setIntensity] = useState<Intensity | null>(null);
  const [sketchLoading, setSketchLoading] = useState(false);
  const [sketchError, setSketchError] = useState<string | null>(null);
  const [shuffleKey, setShuffleKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();
  const writingRef = useRef<WritingSectionHandle>(null);

  // Refs so callbacks always see current state.
  const stateRef = useRef({ character, pins, intensity });
  useEffect(() => {
    stateRef.current = { character, pins, intensity };
  }, [character, pins, intensity]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4500);
  }, []);

  const handleGenerate = useCallback(() => {
    const { character: prev, pins: p, intensity: i } = stateRef.current;
    const { character: next, pins: nextPins } = generateCharacter(prev, p, i);
    if (prev) onArchive(prev);
    setCharacter(next);
    setPins(nextPins);
    setSketchError(null);
    setNotice(null);
    setShuffleKey((k) => k + 1);
    writingRef.current?.reset();
  }, [onArchive]);

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
          // Fall back to a local id so the list stays keyed if the store is down
          id: entryData.id ?? `local-${Date.now()}`,
          concept_id: conceptData.id ?? null,
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

  /**
   * A rollable chip with its lock right beside it. `tail` is the punctuation
   * that follows, kept in the same no-wrap group so the lock and the comma or
   * closing quote never get stranded on the next line.
   */
  const el = (slot: CharacterSlot, tail = '') => {
    if (!character) return null;
    const blocked = !canReroll(character, slot, pins);
    const locked = pins.has(slot);
    return (
      <span className={`slot ${locked ? 'slot-locked' : ''}`}>
        <ClickableElement
          text={slotValue(character, slot)}
          className={`${SLOT_CLASS[slot]} ${locked ? 'el-pinned' : ''}`}
          onReroll={() => handleReroll(slot)}
          title={blocked ? blockedTitle(slot) : rerollTitle(slot)}
          randomLabel={() => randomSlotLabel(slot)}
          shuffleKey={shuffleKey}
          shuffleDuration={SLOT_DURATION[slot]}
          disabled={blocked}
          onBlocked={() => showNotice(blockedTitle(slot))}
        />
        {'⁠'}
        <LockButton
          slot={slot}
          locked={locked}
          onToggle={togglePin}
          className="slot-lock"
        />
        {tail}
      </span>
    );
  };

  return (
    <div className="workspace">
      <section className="gen-pane" aria-label="Character generator">
        <div className="toolbar">
          <GenerateButton onGenerate={handleGenerate} hotkeyEnabled={active} />
          <div className="filter" role="radiogroup" aria-label="Wound weight">
            <span className="field-label">Wound weight</span>
            <div className="segmented">
              {INTENSITIES.map((i) => (
                <button
                  key={i ?? 'any'}
                  type="button"
                  role="radio"
                  aria-checked={intensity === i}
                  className={`seg ${intensity === i ? 'seg-active' : ''}`}
                  onClick={() => setIntensity(i)}
                >
                  {i ? i.charAt(0).toUpperCase() + i.slice(1) : 'Any'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!character ? (
          <div className="stage-empty">
            <span className="stage-empty-icon" aria-hidden="true">
              <UserCircle size={28} />
            </span>
            <p className="stage-empty-title">Press Generate to conjure a character</p>
            <p className="stage-empty-sub">
              Pick a wound weight first for a lighter or heavier start.
              <span className="kbd-hint">
                {' '}
                Press <kbd className="kbd">G</kbd> to generate from the keyboard.
              </span>
            </p>
          </div>
        ) : (
          <div className="concept-enter character-profile">
            <p className="hint">
              <Info size={15} aria-hidden="true" />
              Click a highlighted phrase to re-roll it. Use its lock to keep it through
              the next Generate.
            </p>

            <div className="character-origin">
              After {el('wound', ',')} they came to believe:
            </div>
            <blockquote className="character-belief">
              &ldquo;{el('belief', '\u201D')}
            </blockquote>
            <div className="character-origin">
              So they {el('strategy', '.')} It buys them {el('payoff', ',')} but costs
              them {el('cost', '.')}
            </div>

            <div className="backstory-block">
              <div className="backstory-sentence">
                On an ordinary day they&rsquo;re {el('coping', '.')} When they want
                something, they turn {el('negotiating', '.')} When the wound gets poked,
                they go {el('conflict', '.')} But when the armor slips, they&rsquo;re{' '}
                {el('wildcard', '.')}
              </div>
            </div>

            <div className="character-arc">Their arc: learning that {el('lesson', '.')}</div>

            <p className={`notice ${notice ? 'show' : ''}`} role="status" aria-live="polite">
              {notice && (
                <>
                  <LockSimple size={15} weight="fill" aria-hidden="true" />
                  {notice}
                </>
              )}
            </p>

            {/* Sketch */}
            {sketchLoading && (
              <div className="narrative" aria-busy="true">
                <div className="narrative-label">Sketching character...</div>
                <div className="skeleton" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            {!sketchLoading && character.sketch && (
              <div className="narrative">
                <div className="narrative-label">Sketch</div>
                <div className="narrative-text">{character.sketch}</div>
              </div>
            )}
            {!sketchLoading && !character.sketch && (
              <div className="narrative-action">
                <button className="btn-secondary" onClick={handleSketch} type="button">
                  <Feather size={16} aria-hidden="true" />
                  Create Sketch
                </button>
                {sketchError && (
                  <p className="inline-error" role="alert">
                    <Warning size={16} aria-hidden="true" />
                    {sketchError}
                  </p>
                )}
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
      </section>

      <aside className="pad-pane" aria-label="Writing pad">
        <WritingSection
          ref={writingRef}
          ready={!!character}
          onSave={handleSave}
          prompt="Now write a scene that reveals them..."
          placeholder="Show the strategy working, then show it cost them..."
          emptyHint="Generate a character and your writing pad opens here."
        />
      </aside>
    </div>
  );
}

// ---------- lock toggle, shared by the inline chips and the anatomy list ----------

function LockButton({
  slot,
  locked,
  onToggle,
  className,
}: {
  slot: CharacterSlot;
  locked: boolean;
  onToggle: (slot: CharacterSlot) => void;
  className: string;
}) {
  const name = SLOT_LABELS[slot];
  return (
    <button
      type="button"
      className={`${className} ${locked ? 'is-locked' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(slot);
      }}
      aria-pressed={locked}
      aria-label={locked ? `Unlock ${name}` : `Lock ${name}`}
      title={locked ? `Unlock ${name}` : `Lock ${name} (survives Generate)`}
    >
      {locked ? (
        <LockSimple size={14} weight="fill" aria-hidden="true" />
      ) : (
        <LockSimpleOpen size={14} aria-hidden="true" />
      )}
    </button>
  );
}

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
        `${s.stance} (${GRAPH.enums.stance[s.stance]})`,
        `${s.outlook} (${GRAPH.enums.outlook[s.outlook]})`,
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
  const [open, setOpen] = useState(false);
  return (
    <section className={`anatomy ${open ? 'open' : ''}`}>
      <div className="anatomy-head">
        <button
          type="button"
          className="anatomy-toggle"
          aria-expanded={open}
          aria-controls="anatomy-body"
          onClick={() => setOpen((o) => !o)}
        >
          <CaretRight className="anatomy-caret" size={14} weight="bold" aria-hidden="true" />
          <span className="anatomy-title">Anatomy</span>
          <span className="anatomy-count">
            {pins.size > 0 ? `${pins.size} locked` : 'Nothing locked'}
          </span>
        </button>
        {pins.size > 0 && (
          <button type="button" className="btn-link" onClick={onClearPins}>
            Unlock all
          </button>
        )}
      </div>
      <div id="anatomy-body" hidden={!open}>
        <p className="anatomy-hint">
          Lock what you like; Generate re-rolls everything else around it. Belief and
          strategy are a pair, so locking one holds the other.
        </p>
        <ul className="anatomy-list">
          {CHARACTER_SLOTS.map((slot) => {
            const locked = pins.has(slot);
            const held =
              !locked &&
              slot === 'strategy' &&
              (['belief', 'payoff', 'cost'] as CharacterSlot[]).some((s) => pins.has(s));
            const meta = slotMeta(character, slot);
            return (
              <li key={slot} className={`anatomy-row ${locked ? 'locked' : ''}`}>
                <LockButton
                  slot={slot}
                  locked={locked}
                  onToggle={onTogglePin}
                  className="anatomy-lock"
                />
                <div className="anatomy-label">{SLOT_LABELS[slot]}</div>
                <div className="anatomy-value">
                  {slotValue(character, slot)}
                  {meta.length > 0 && (
                    <div className="anatomy-meta">
                      {meta.map((m) => (
                        <span key={m} className="tag">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                  {held && (
                    <div className="anatomy-held">held by the locked belief</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
