import graphJson from '../data/character_graph.json';
import {
  Belief,
  Character,
  CharacterGraph,
  CharacterSlot,
  ConflictTrait,
  Intensity,
  Strategy,
  Wound,
} from './character-types';

/*
 * Character engine.
 *
 * Chain: wound -> belief -> strategy (implied by belief) -> traits.
 * payoff/cost come from the belief; the lesson pool is the belief's lesson
 * plus the strategy's lessons.
 *
 * Sampling (per the graph's "sampling" note): pick a belief uniformly (keeps
 * the nine strategies balanced), then a random wound linked to it. Re-rolls
 * cascade downstream. Pinned slots survive the cascade and constrain it.
 */

export const GRAPH = graphJson as unknown as CharacterGraph;

const WOUNDS = new Map<string, Wound>(GRAPH.wounds.map((w) => [w.id, w]));
const BELIEFS = new Map<string, Belief>(GRAPH.beliefs.map((b) => [b.id, b]));
const STRATEGIES = new Map<string, Strategy>(
  GRAPH.strategies.map((s) => [s.id, s])
);

export const getWound = (id: string) => WOUNDS.get(id)!;
export const getBelief = (id: string) => BELIEFS.get(id)!;
export const getStrategy = (id: string) => STRATEGIES.get(id)!;
export const woundOf = (c: Character) => getWound(c.woundId);
export const beliefOf = (c: Character) => getBelief(c.beliefId);
export const strategyOf = (c: Character) => getStrategy(beliefOf(c).strategy);

export function lessonPool(belief: Belief): string[] {
  return [belief.lesson, ...getStrategy(belief.strategy).lessons];
}

// ---------- randomness ----------

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Random pick, avoiding `current` when there is any alternative. */
function randOther<T>(arr: T[], current: T, eq: (a: T, b: T) => boolean = (a, b) => a === b): T {
  const others = arr.filter((x) => !eq(x, current));
  return rand(others.length ? others : arr);
}

const sameConflict = (a: ConflictTrait, b: ConflictTrait) => a.word === b.word;

// ---------- constraint solving for (wound, belief) ----------

type Pins = ReadonlySet<CharacterSlot>;
export type Change = 'all' | 'wound' | 'belief' | 'strategy';

const BELIEF_LEVEL: CharacterSlot[] = ['belief', 'payoff', 'cost'];
const STRATEGY_LEVEL: CharacterSlot[] = [
  'strategy',
  'coping',
  'negotiating',
  'conflict',
  'wildcard',
];

interface Attempt {
  intensity: boolean;
  wound: boolean;
  belief: boolean;
  strategy: boolean;
  lesson: boolean;
  /** Keep the current wound (soft preference for belief/strategy re-rolls). */
  fixWound?: boolean;
}

// Strictest first; each step relaxes one constraint so a roll always succeeds.
const RELAXATION: Attempt[] = [
  { intensity: true, wound: true, belief: true, strategy: true, lesson: true },
  { intensity: false, wound: true, belief: true, strategy: true, lesson: true },
  { intensity: false, wound: true, belief: true, strategy: true, lesson: false },
  { intensity: false, wound: true, belief: true, strategy: false, lesson: false },
  { intensity: false, wound: true, belief: false, strategy: false, lesson: false },
  { intensity: false, wound: false, belief: false, strategy: false, lesson: false },
];

interface Pair {
  wound: Wound;
  belief: Belief;
}

function candidatePairs(
  prev: Character | null,
  pins: Pins,
  intensity: Intensity | null,
  change: Change,
  a: Attempt
): Pair[] {
  const has = (s: CharacterSlot) => !!prev && pins.has(s);
  // The clicked slot's own pins don't constrain its re-roll.
  const pinWound = a.wound && has('wound') && change !== 'wound';
  const pinBelief =
    a.belief &&
    change !== 'belief' &&
    change !== 'strategy' &&
    BELIEF_LEVEL.some(has);
  const pinStrategy =
    a.strategy && change !== 'strategy' && STRATEGY_LEVEL.some(has);
  const pinLesson = a.lesson && has('lesson');

  const prevBelief = prev ? beliefOf(prev) : null;
  const out: Pair[] = [];

  for (const wound of GRAPH.wounds) {
    if (prev && (pinWound || a.fixWound) && wound.id !== prev.woundId) continue;
    if (change === 'wound' && prev && wound.id === prev.woundId) continue;
    if (
      a.intensity &&
      intensity &&
      !pinWound &&
      !a.fixWound &&
      wound.intensity !== intensity
    )
      continue;

    for (const bid of wound.beliefs) {
      const belief = getBelief(bid);
      if (prev && prevBelief) {
        if (pinBelief && belief.id !== prevBelief.id) continue;
        if (pinStrategy && belief.strategy !== prevBelief.strategy) continue;
        if (pinLesson && !lessonPool(belief).includes(prev.lesson)) continue;
        if (change === 'belief' && belief.id === prevBelief.id) continue;
        if (change === 'strategy' && belief.strategy === prevBelief.strategy)
          continue;
      }
      out.push({ wound, belief });
    }
  }
  return out;
}

function samplePair(pairs: Pair[], change: Change): Pair {
  if (change === 'wound') {
    // New wound uniformly, then one of its (valid) beliefs.
    const wounds = Array.from(new Set(pairs.map((p) => p.wound.id)));
    const wid = rand(wounds);
    return rand(pairs.filter((p) => p.wound.id === wid));
  }
  // Belief uniformly (keeps strategies balanced), then a linked wound.
  const beliefs = Array.from(new Set(pairs.map((p) => p.belief.id)));
  const bid = rand(beliefs);
  return rand(pairs.filter((p) => p.belief.id === bid));
}

function solvePair(
  prev: Character | null,
  pins: Pins,
  intensity: Intensity | null,
  change: Change
): Pair {
  const attempts: Attempt[] =
    prev && (change === 'belief' || change === 'strategy')
      ? [...RELAXATION.map((a) => ({ ...a, fixWound: true })), ...RELAXATION]
      : RELAXATION;

  for (const a of attempts) {
    const pairs = candidatePairs(prev, pins, intensity, change, a);
    if (pairs.length) return samplePair(pairs, change);
  }
  // Unreachable with the shipped graph, but never fail a roll.
  const wound = rand(GRAPH.wounds);
  return { wound, belief: getBelief(rand(wound.beliefs)) };
}

// ---------- building a character ----------

function build(
  pair: Pair,
  prev: Character | null,
  pins: Pins
): Character {
  const { wound, belief } = pair;
  const strategy = getStrategy(belief.strategy);
  const t = strategy.traits;

  function keep<T>(
    slot: CharacterSlot,
    prevVal: T | undefined,
    pool: T[],
    eq: (a: T, b: T) => boolean = (a, b) => a === b
  ): T {
    if (prev && pins.has(slot) && prevVal !== undefined && pool.some((x) => eq(x, prevVal))) {
      return prevVal;
    }
    return rand(pool);
  }

  return {
    id: Math.random().toString(36).slice(2),
    woundId: wound.id,
    beliefId: belief.id,
    payoff: keep('payoff', prev?.payoff, belief.payoffs),
    cost: keep('cost', prev?.cost, belief.costs),
    coping: keep('coping', prev?.coping, t.coping),
    negotiating: keep('negotiating', prev?.negotiating, t.negotiating),
    conflict: keep('conflict', prev?.conflict, t.conflict, sameConflict),
    wildcard: keep('wildcard', prev?.wildcard, t.wildcard),
    lesson: keep('lesson', prev?.lesson, lessonPool(belief)),
    sketch: null,
  };
}

/** Pins whose value didn't survive (e.g. a trait pinned to a strategy that changed). */
function survivingPins(prev: Character, next: Character, pins: Pins): Set<CharacterSlot> {
  const kept = new Set<CharacterSlot>();
  pins.forEach((slot) => {
    if (slotValue(prev, slot) === slotValue(next, slot)) kept.add(slot);
  });
  return kept;
}

export interface RollResult {
  character: Character;
  pins: Set<CharacterSlot>;
}

/** Full roll. Pinned slots on `prev` survive and constrain everything else. */
export function generateCharacter(
  prev: Character | null,
  pins: Pins,
  intensity: Intensity | null
): RollResult {
  const pair = solvePair(prev, pins, intensity, 'all');
  const character = build(pair, prev, pins);
  return {
    character,
    pins: prev ? survivingPins(prev, character, pins) : new Set(),
  };
}

/** Re-roll one slot. Wound/belief/strategy cascade downstream; traits don't. */
export function rerollSlot(
  c: Character,
  slot: CharacterSlot,
  pins: Pins,
  intensity: Intensity | null
): RollResult {
  if (slot === 'wound' || slot === 'belief' || slot === 'strategy') {
    const pair = solvePair(c, pins, intensity, slot);
    // The clicked slot is re-rolled even if pinned; keep its pin flag on.
    const buildPins = new Set(pins);
    const character = build(pair, c, buildPins);
    const next = survivingPins(c, character, pins);
    if (pins.has(slot)) next.add(slot);
    return { character, pins: next };
  }

  const belief = beliefOf(c);
  const t = strategyOf(c).traits;
  const next: Character = { ...c, sketch: null };
  switch (slot) {
    case 'payoff':
      next.payoff = randOther(belief.payoffs, c.payoff);
      break;
    case 'cost':
      next.cost = randOther(belief.costs, c.cost);
      break;
    case 'coping':
      next.coping = randOther(t.coping, c.coping);
      break;
    case 'negotiating':
      next.negotiating = randOther(t.negotiating, c.negotiating);
      break;
    case 'conflict':
      next.conflict = randOther(t.conflict, c.conflict, sameConflict);
      break;
    case 'wildcard':
      next.wildcard = randOther(t.wildcard, c.wildcard);
      break;
    case 'lesson':
      next.lesson = randOther(lessonPool(belief), c.lesson);
      break;
  }
  return { character: next, pins: new Set(pins) };
}

// ---------- text ----------

export function slotValue(c: Character, slot: CharacterSlot): string {
  switch (slot) {
    case 'wound':
      return woundOf(c).label;
    case 'belief':
      return beliefOf(c).label;
    case 'strategy':
      return strategyOf(c).label;
    case 'conflict':
      return c.conflict.word;
    default:
      return c[slot];
  }
}

/** Every label a slot can take anywhere in the graph (for the shuffle animation). */
const POOLS: Record<CharacterSlot, string[]> = {
  wound: GRAPH.wounds.map((w) => w.label),
  belief: GRAPH.beliefs.map((b) => b.label),
  strategy: GRAPH.strategies.map((s) => s.label),
  payoff: GRAPH.beliefs.flatMap((b) => b.payoffs),
  cost: GRAPH.beliefs.flatMap((b) => b.costs),
  coping: GRAPH.strategies.flatMap((s) => s.traits.coping),
  negotiating: GRAPH.strategies.flatMap((s) => s.traits.negotiating),
  conflict: GRAPH.strategies.flatMap((s) => s.traits.conflict.map((x) => x.word)),
  wildcard: GRAPH.strategies.flatMap((s) => s.traits.wildcard),
  lesson: GRAPH.beliefs.map((b) => b.lesson).concat(GRAPH.strategies.flatMap((s) => s.lessons)),
};

export function randomSlotLabel(slot: CharacterSlot): string {
  return rand(POOLS[slot]);
}

/** The graph's template, filled in as plain text. */
export function characterText(c: Character): string {
  return GRAPH.template.replace(/\{(\w+)\}/g, (_, key: string) =>
    slotValue(c, key as CharacterSlot)
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Short one-line label for saved entries / history headers. */
export function characterSummaryHTML(c: Character): string {
  return (
    `<span class="hl-conflict">${escapeHtml(woundOf(c).label)}</span> → ` +
    `<span class="hl-agent">“${escapeHtml(beliefOf(c).label)}”</span>`
  );
}

/** Structured elements for the sketch prompt. */
export function characterElements(c: Character): string {
  const w = woundOf(c);
  const b = beliefOf(c);
  const s = strategyOf(c);
  return [
    `Wound (${w.intensity}): ${w.label}`,
    `Core belief (about ${b.locus}): ${b.label}`,
    `Strategy: ${s.label} (stance: ${s.stance}; outlook: ${s.outlook})`,
    `Core fear: ${s.fear}. Core desire: ${s.desire}.`,
    `Payoff: ${c.payoff}`,
    `Cost: ${c.cost}`,
    `Ordinary day: ${c.coping}`,
    `When they want something: ${c.negotiating}`,
    `Under threat: ${c.conflict.word} (${c.conflict.mode}: ${GRAPH.enums.conflictMode[c.conflict.mode]})`,
    `When the armor slips: ${c.wildcard}`,
    `Arc: learning that ${c.lesson}`,
  ].join('\n');
}
