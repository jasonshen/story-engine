'use client';

import { Concept } from '@/lib/types';
import {
  agentDisplayName,
  anchorDisplayName,
  enginePlural,
} from '@/lib/grammar';
import Drawer from './Drawer';

interface ConceptHistoryProps {
  history: Concept[];
}

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

export default function ConceptHistory({ history }: ConceptHistoryProps) {
  const reversed = [...history].reverse();

  return (
    <Drawer title="Previous concepts" count={history.length}>
      {reversed.length === 0 ? (
        <p className="drawer-empty">Concepts will collect here as you deal.</p>
      ) : (
        <ol className="history-list">
          {reversed.map((c, idx) => (
            <li key={`${c.id}-${idx}`} className="history-item">
              <span className="history-num">No. {history.length - idx}</span>
              <span
                className="history-logline"
                dangerouslySetInnerHTML={{ __html: summaryHTML(c) }}
              />
              {c.narrative && <span className="history-narr">{c.narrative}</span>}
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
