'use client';

import { Concept } from '@/lib/types';
import { Character } from '@/lib/character-types';
import { characterText } from '@/lib/character-engine';
import { agentDisplayName, anchorDisplayName, enginePlural } from '@/lib/grammar';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function summaryHTML(c: Concept): string {
  const agParts = c.agents.map(
    (a) => `<span class="hl-agent">${escapeHtml(agentDisplayName(a))}</span>`
  );
  const anParts = c.anchors.map(
    (a) => `<span class="hl-anchor">${escapeHtml(anchorDisplayName(a))}</span>`
  );
  const eng = `<span class="hl-engine">${escapeHtml(
    enginePlural(c.engine.label, c.agents.length)
  )}</span>`;
  const conf = `<span class="hl-conflict">${escapeHtml(
    c.conflict.label.replace(/^But /, 'but ')
  )}</span>`;
  return agParts.join(' &amp; ') + ' ' + eng + ' ' + anParts.join(' &amp; ') + ', ' + conf + '.';
}

function HistoryShell({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="archive-section" aria-label={title}>
      <h2 className="archive-title">{title}</h2>
      {count === 0 ? (
        <p className="archive-empty">{empty}</p>
      ) : (
        <ol className="archive-list history-list" reversed>
          {children}
        </ol>
      )}
    </section>
  );
}

export default function ConceptHistory({ history }: { history: Concept[] }) {
  const reversed = [...history].reverse();
  return (
    <HistoryShell
      title="Previous concepts"
      empty="Concepts will collect here as you generate."
      count={history.length}
    >
      {reversed.map((c, idx) => (
        <li key={`${c.id}-${idx}`} className="history-item">
          <span className="history-num">No. {history.length - idx}</span>
          <p className="history-logline" dangerouslySetInnerHTML={{ __html: summaryHTML(c) }} />
          {c.narrative && <p className="history-narr">{c.narrative}</p>}
        </li>
      ))}
    </HistoryShell>
  );
}

export function CharacterHistory({ history }: { history: Character[] }) {
  const reversed = [...history].reverse();
  return (
    <HistoryShell
      title="Previous characters"
      empty="Characters will collect here as you generate."
      count={history.length}
    >
      {reversed.map((c, idx) => (
        <li key={`${c.id}-${idx}`} className="history-item">
          <span className="history-num">No. {history.length - idx}</span>
          <p className="history-logline">{characterText(c)}</p>
          {c.sketch && <p className="history-narr">{c.sketch}</p>}
        </li>
      ))}
    </HistoryShell>
  );
}
