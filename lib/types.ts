export type CardType =
  | 'agent'
  | 'engine'
  | 'anchor'
  | 'conflict'
  | 'aspect'
  | 'backstory-engine'
  | 'backstory-conflict';

export interface Card {
  id: string;
  cardId: string;
  pack: 'main' | 'expansion';
  type: CardType;
  label: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export interface Backstory {
  engine: Card;
  target: Card;
  targetAspect: Card | null;
  conflict: Card;
}

export interface AgentEntry {
  agent: Card;
  aspect: Card | null;
  backstory: Backstory | null;
}

export interface AnchorEntry {
  anchor: Card;
  aspect: Card | null;
}

export interface Concept {
  id: string;
  agents: AgentEntry[];
  engine: Card;
  anchors: AnchorEntry[];
  conflict: Card;
  narrative: string | null;
}

export interface SavedConcept {
  id: string;
  concept_data: Concept;
  summary_text: string;
  narrative: string | null;
  created_at: string;
}

export interface WritingEntry {
  id: string;
  concept_id: string | null;
  concept_summary: string;
  opening_style: string | null;
  body: string;
  word_count: number;
  duration_seconds: number | null;
  created_at: string;
}

export type OpeningStyle =
  | 'dialogue'
  | 'action'
  | 'suspense'
  | 'monologue'
  | 'object'
  | 'setting'
  | 'character';

export const OPENING_LABELS: Record<OpeningStyle, string> = {
  dialogue: 'Dialogue',
  action: 'Action / in medias res',
  suspense: 'Suspenseful slow build',
  monologue: 'Internal monologue',
  object: 'Description of object or action',
  setting: 'Description of setting or event',
  character: 'Description of character',
};
