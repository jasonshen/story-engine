import cardsJson from '../data/story_engine_cards.json';
import { Card, CardType } from './types';

const ALL_CARDS: Card[] = cardsJson as Card[];

const INDEX: Record<string, Card[]> = {};
for (const card of ALL_CARDS) {
  if (!INDEX[card.type]) INDEX[card.type] = [];
  INDEX[card.type].push(card);
}

export function getCardsByType(type: CardType): Card[] {
  return INDEX[type] || [];
}

export function getAllCards(): Card[] {
  return ALL_CARDS;
}

/** Get N random labels from a card type (for shuffle animation) */
export function getRandomLabels(type: CardType, count: number): string[] {
  const cards = INDEX[type] || [];
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    labels.push(cards[Math.floor(Math.random() * cards.length)].label);
  }
  return labels;
}
