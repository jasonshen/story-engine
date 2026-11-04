export type Intensity = 'everyday' | 'formative' | 'catastrophic';
export type Locus = 'world' | 'others' | 'self' | 'possibility';
export type Stance = 'assertive' | 'compliant' | 'withdrawn';
export type Outlook = 'positive' | 'competency' | 'reactive';
export type ConflictMode = 'bigger' | 'sharper' | 'smaller' | 'sideways';

export interface ConflictTrait {
  word: string;
  mode: ConflictMode;
}

export interface Strategy {
  id: string;
  inspiredBy: string;
  label: string;
  stance: Stance;
  outlook: Outlook;
  fear: string;
  desire: string;
  lessons: string[];
  traits: {
    coping: string[];
    negotiating: string[];
    conflict: ConflictTrait[];
    wildcard: string[];
  };
}

export interface Wound {
  id: string;
  intensity: Intensity;
  label: string;
  beliefs: string[];
}

export interface Belief {
  id: string;
  strategy: string;
  locus: Locus;
  label: string;
  payoffs: string[];
  costs: string[];
  lesson: string;
}

export interface CharacterGraph {
  version: number;
  template: string;
  enums: {
    intensity: Intensity[];
    locus: Locus[];
    stance: Record<Stance, string>;
    outlook: Record<Outlook, string>;
    conflictMode: Record<ConflictMode, string>;
  };
  strategies: Strategy[];
  wounds: Wound[];
  beliefs: Belief[];
}

/** Every rollable slot in the character template. */
export type CharacterSlot =
  | 'wound'
  | 'belief'
  | 'strategy'
  | 'payoff'
  | 'cost'
  | 'coping'
  | 'negotiating'
  | 'conflict'
  | 'wildcard'
  | 'lesson';

export const CHARACTER_SLOTS: CharacterSlot[] = [
  'wound',
  'belief',
  'strategy',
  'payoff',
  'cost',
  'coping',
  'negotiating',
  'conflict',
  'wildcard',
  'lesson',
];

export const SLOT_LABELS: Record<CharacterSlot, string> = {
  wound: 'Wound',
  belief: 'Belief',
  strategy: 'Strategy',
  payoff: 'Payoff',
  cost: 'Cost',
  coping: 'Ordinary day',
  negotiating: 'Wanting something',
  conflict: 'Wound poked',
  wildcard: 'Armor slips',
  lesson: 'Arc',
};

/**
 * A rolled character. Wound/belief are stored by id (strategy is implied by
 * the belief); everything else is the chosen string from its pool.
 */
export interface Character {
  id: string;
  woundId: string;
  beliefId: string;
  payoff: string;
  cost: string;
  coping: string;
  negotiating: string;
  conflict: ConflictTrait;
  wildcard: string;
  lesson: string;
  sketch: string | null;
}
