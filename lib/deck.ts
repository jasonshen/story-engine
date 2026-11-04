/**
 * Shuffled decks ("shuffle bags") for drawing without repeats.
 *
 * Each pool of options is a deck: shuffled once, then drawn from the top.
 * Nothing comes up again until every option in the pool has been drawn;
 * then the pool is reshuffled (avoiding an immediate repeat across the
 * seam). Draws can carry a filter (e.g. "not one already on the table",
 * "a belief this wound allows"): the first card from the top that passes is
 * taken and the skipped cards stay where they are, so they come up next.
 *
 * Decks live for the page session, keyed by a stable string per pool.
 */

function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class Deck<T> {
  private pile: T[] = [];
  private last: T | undefined;

  constructor(
    private readonly items: readonly T[],
    private readonly same: (a: T, b: T) => boolean
  ) {}

  private reshuffle() {
    const fresh = shuffle(this.items);
    // Don't let the first card of the new cycle repeat the last one drawn.
    if (fresh.length > 1 && this.last !== undefined && this.same(fresh[0], this.last)) {
      const j = 1 + Math.floor(Math.random() * (fresh.length - 1));
      [fresh[0], fresh[j]] = [fresh[j], fresh[0]];
    }
    // Cards left over from the current cycle stay on top.
    this.pile = this.pile.concat(fresh);
  }

  draw(accept: (item: T) => boolean = () => true): T | undefined {
    if (!this.items.length) return undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const i = this.pile.findIndex(accept);
      if (i >= 0) {
        const [card] = this.pile.splice(i, 1);
        this.last = card;
        return card;
      }
      this.reshuffle();
    }
    return undefined; // nothing in the pool passes the filter
  }
}

const decks = new Map<string, Deck<unknown>>();

/**
 * Draw from the deck for `key` (created from `items` on first use).
 * Returns undefined only if no item passes `accept`.
 */
export function drawFrom<T>(
  key: string,
  items: readonly T[],
  accept?: (item: T) => boolean,
  same: (a: T, b: T) => boolean = (a, b) => a === b
): T | undefined {
  let deck = decks.get(key) as Deck<T> | undefined;
  if (!deck) {
    deck = new Deck(items, same);
    decks.set(key, deck as Deck<unknown>);
  }
  return deck.draw(accept);
}
