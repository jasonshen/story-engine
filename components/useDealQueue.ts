'use client';

import { useCallback, useState } from 'react';

/**
 * Which cards of the current deal have been asked to deal (with each one's
 * turn within its batch) and which have actually landed on the table.
 */
export function useDealQueue<K extends string>() {
  const [queued, setQueued] = useState<ReadonlyMap<K, number>>(new Map());
  const [landed, setLanded] = useState<ReadonlySet<K>>(new Set());
  const [carried, setCarried] = useState<ReadonlySet<K>>(new Set());

  /** Start a new deal; `onTable` are cards already showing (e.g. locked). */
  const reset = useCallback((onTable: K[] = []) => {
    setQueued(new Map(onTable.map((k) => [k, 0])));
    setLanded(new Set(onTable));
    setCarried(new Set(onTable));
  }, []);

  /** Deal these cards, one after another in the order given. */
  const queue = useCallback((keys: K[]) => {
    setQueued((prev) => {
      const next = new Map(prev);
      let turn = 0;
      for (const k of keys) if (!next.has(k)) next.set(k, turn++);
      return next;
    });
  }, []);

  const land = useCallback((k: K) => {
    setLanded((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
  }, []);

  return { queued, landed, carried, reset, queue, land };
}

/** Button state for a deal laid out in named groups. */
export function dealProgress<K extends string>(
  keys: K[],
  groupOf: (k: K) => number,
  groupNames: string[],
  queued: ReadonlyMap<K, number>,
  landed: ReadonlySet<K>,
  carried: ReadonlySet<K> = new Set()
) {
  const dealing = keys.some((k) => queued.has(k) && !landed.has(k));
  const complete = keys.length > 0 && keys.every((k) => landed.has(k));
  const started = keys.some((k) => queued.has(k) && !carried.has(k));
  // The next group is the first one with any card not yet asked for.
  let nextGroup = -1;
  for (let g = 0; g < groupNames.length && nextGroup < 0; g++) {
    if (keys.some((k) => groupOf(k) === g && !queued.has(k))) nextGroup = g;
  }
  const nextKeys = nextGroup < 0 ? [] : keys.filter((k) => groupOf(k) === nextGroup && !queued.has(k));
  return {
    dealing,
    complete,
    started,
    nextKeys,
    nextName: nextGroup < 0 ? null : groupNames[nextGroup],
    dealtCount: keys.filter((k) => landed.has(k)).length,
    total: keys.length,
  };
}
