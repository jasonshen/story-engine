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
import { drawFrom } from './deck';

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

const byId = <T extends { id: string }>(a: T, b: T) => a.id === b.id;

/**
 * Draw from the shuffled deck for this pool, avoiding `current` when there
 * is any alternative. Every option comes up once before any repeats.
 */
function drawPool<T>(
  key: string,
  pool: T[],
  current?: T,
  eq: (a: T, b: T) => boolean = (a, b) => a === b
): T {
  const notCurrent = current === undefined ? undefined : (x: T) => !eq(x, current);
  return drawFrom(key, pool, notCurrent, eq) ?? drawFrom(key, pool, undefined, eq) ?? rand(pool);
}

/** Draw the next wound or belief whose id is in `ids`. A single option is
 *  taken as-is, so a fixed or locked choice doesn't use up a card. */
function drawWhere<T extends { id: string }>(key: string, all: T[], ids: Set<string>): T {
  if (ids.size === 1) {
    const only = ids.values().next().value as string;
    return all.find((x) => x.id === only)!;
  }
  return drawFrom(key, all, (x) => ids.has(x.id), byId) ?? all.find((x) => ids.has(x.id))!;
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
  /** Respect the wound-weight filter (a preference, so it can be relaxed). */
  intensity: boolean;
  /** Keep the current wound (soft preference for belief/strategy re-rolls). */
  fixWound?: boolean;
}

interface Pair {
  wound: Wound;
  belief: Belief;
}

/**
 * Valid (wound, belief) pairs. Locks are hard constraints: the only lock that
 * doesn't apply is the clicked slot's own. Belief and strategy are paired 1:1
 * in the graph, so locking anything at belief level also fixes the strategy.
 */
function candidatePairs(
  prev: Character | null,
  pins: Pins,
  intensity: Intensity | null,
  change: Change,
  a: Attempt
): Pair[] {
  const has = (s: CharacterSlot) => !!prev && pins.has(s) && s !== change;
  const pinWound = has('wound');
  const pinBelief = BELIEF_LEVEL.some(has);
  const pinStrategy = STRATEGY_LEVEL.some(has);
  const pinLesson = has('lesson');

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
  const woundIds = (ps: Pair[]) => new Set(ps.map((p) => p.wound.id));
  const beliefIds = (ps: Pair[]) => new Set(ps.map((p) => p.belief.id));
  if (change === 'wound') {
    // Next wound from the wound deck, then one of its (valid) beliefs.
    const wound = drawWhere('char:wound', GRAPH.wounds, woundIds(pairs));
    const withWound = pairs.filter((p) => p.wound.id === wound.id);
    const belief = drawWhere('char:belief', GRAPH.beliefs, beliefIds(withWound));
    return { wound, belief };
  }
  // Next belief from the belief deck (all 63 come up before any repeats, which
  // also keeps the nine strategies balanced), then a linked wound.
  const belief = drawWhere('char:belief', GRAPH.beliefs, beliefIds(pairs));
  const withBelief = pairs.filter((p) => p.belief.id === belief.id);
  const wound = drawWhere('char:wound', GRAPH.wounds, woundIds(withBelief));
  return { wound, belief };
}

/** The valid pairs for this change, or null when the locks block it. Pure:
 *  draws nothing, so it is safe to call on every render. */
function findPairs(
  prev: Character | null,
  pins: Pins,
  intensity: Intensity | null,
  change: Change
): Pair[] | null {
  const attempts: Attempt[] =
    prev && (change === 'belief' || change === 'strategy')
      ? [
          { intensity: false, fixWound: true },
          { intensity: true },
          { intensity: false },
        ]
      : [{ intensity: true }, { intensity: false }];

  for (const a of attempts) {
    const pairs = candidatePairs(prev, pins, intensity, change, a);
    if (pairs.length) return pairs;
  }
  return null;
}

/** Null when no pair satisfies the locks (the re-roll is blocked). */
function solvePair(
  prev: Character | null,
  pins: Pins,
  intensity: Intensity | null,
  change: Change
): Pair | null {
  const pairs = findPairs(prev, pins, intensity, change);
  return pairs ? samplePair(pairs, change) : null;
}

/** Whether a slot can be re-rolled without breaking any other lock. */
export function canReroll(c: Character, slot: CharacterSlot, pins: Pins): boolean {
  if (slot === 'wound' || slot === 'belief' || slot === 'strategy') {
    return findPairs(c, pins, null, slot) !== null;
  }
  return true;
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
    deckKey: string,
    prevVal: T | undefined,
    pool: T[],
    eq: (a: T, b: T) => boolean = (a, b) => a === b
  ): T {
    if (prev && pins.has(slot) && prevVal !== undefined && pool.some((x) => eq(x, prevVal))) {
      return prevVal;
    }
    return drawPool(deckKey, pool, undefined, eq);
  }

  return {
    id: Math.random().toString(36).slice(2),
    woundId: wound.id,
    beliefId: belief.id,
    payoff: keep('payoff', `char:payoff:${belief.id}`, prev?.payoff, belief.payoffs),
    cost: keep('cost', `char:cost:${belief.id}`, prev?.cost, belief.costs),
    coping: keep('coping', `char:coping:${strategy.id}`, prev?.coping, t.coping),
    negotiating: keep('negotiating', `char:negotiating:${strategy.id}`, prev?.negotiating, t.negotiating),
    conflict: keep('conflict', `char:conflict:${strategy.id}`, prev?.conflict, t.conflict, sameConflict),
    wildcard: keep('wildcard', `char:wildcard:${strategy.id}`, prev?.wildcard, t.wildcard),
    lesson: keep('lesson', `char:lesson:${belief.id}`, prev?.lesson, lessonPool(belief)),
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
  // prev always satisfies its own locks, so this only fails on a cold start
  // with an impossible filter, which the graph doesn't allow.
  const pair =
    solvePair(prev, pins, intensity, 'all') ?? solvePair(null, new Set(), null, 'all')!;
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
    // Blocked by another lock: leave everything as it is.
    if (!pair) return { character: c, pins: new Set(pins) };
    const character = build(pair, c, pins);
    // Every other lock held; the clicked slot keeps its lock flag.
    const next = survivingPins(c, character, pins);
    if (pins.has(slot)) next.add(slot);
    return { character, pins: next };
  }

  const belief = beliefOf(c);
  const strategy = strategyOf(c);
  const t = strategy.traits;
  const next: Character = { ...c, sketch: null };
  switch (slot) {
    case 'payoff':
      next.payoff = drawPool(`char:payoff:${belief.id}`, belief.payoffs, c.payoff);
      break;
    case 'cost':
      next.cost = drawPool(`char:cost:${belief.id}`, belief.costs, c.cost);
      break;
    case 'coping':
      next.coping = drawPool(`char:coping:${strategy.id}`, t.coping, c.coping);
      break;
    case 'negotiating':
      next.negotiating = drawPool(`char:negotiating:${strategy.id}`, t.negotiating, c.negotiating);
      break;
    case 'conflict':
      next.conflict = drawPool(`char:conflict:${strategy.id}`, t.conflict, c.conflict, sameConflict);
      break;
    case 'wildcard':
      next.wildcard = drawPool(`char:wildcard:${strategy.id}`, t.wildcard, c.wildcard);
      break;
    case 'lesson':
      next.lesson = drawPool(`char:lesson:${belief.id}`, lessonPool(belief), c.lesson);
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
