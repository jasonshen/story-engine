'use client';

import { Concept } from '@/lib/types';
import {
  agentDisplayName,
  anchorDisplayName,
  enginePlural,
} from '@/lib/grammar';

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
    <div className="history">
      <hr className="history-rule" />
      <div className="history-title">Previous concepts</div>
      <div>
        {reversed.length === 0 ? (
          <div className="history-empty">
            Concepts will collect here as you generate.
          </div>
        ) : (
          reversed.map((c, idx) => (
            <div key={`${c.id}-${idx}`} className="history-item">
              <div className="history-num">No. {history.length - idx}</div>
              <div
                className="history-logline"
                dangerouslySetInnerHTML={{ __html: summaryHTML(c) }}
              />
              {c.narrative && (
                <div className="history-narr">{c.narrative}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
