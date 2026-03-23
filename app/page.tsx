'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Concept, WritingEntry } from '@/lib/types';
import { generateConcept, rerollElement } from '@/lib/engine';
import {
  agentDisplayName,
  anchorDisplayName,
  enginePlural,
  bsAnchorName,
} from '@/lib/grammar';
import ConceptDisplay from '@/components/ConceptDisplay';
import WritingSection, { WritingSectionHandle } from '@/components/WritingSection';
import SavedEntries from '@/components/SavedEntries';
import ConceptHistory from '@/components/ConceptHistory';

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
  return (
    agParts.join(' &amp; ') +
    ' ' +
    eng +
    ' ' +
    anParts.join(' &amp; ') +
    ', ' +
    conf +
    '.'
  );
}

function buildNarrativeElements(concept: Concept): string {
  const lines: string[] = [];
  concept.agents.forEach((a, i) => {
    lines.push('Agent ' + (i + 1) + ': ' + agentDisplayName(a));
    if (a.backstory) {
      lines.push(
        '  Backstory: ' +
          a.backstory.engine.label +
          ' ' +
          bsAnchorName(a.backstory)
      );
      lines.push('  Complication: ' + a.backstory.conflict.label);
    }
  });
  lines.push('Drive: ' + concept.engine.label);
  concept.anchors.forEach((a) =>
    lines.push('Key object/place: ' + anchorDisplayName(a))
  );
  lines.push('Central conflict: ' + concept.conflict.label);
  return lines.join('\n');
}

export default function Home() {
  const [concept, setConcept] = useState<Concept | null>(null);
  const [history, setHistory] = useState<Concept[]>([]);
  const [narrativeMode, setNarrativeMode] = useState(false);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [savedEntries, setSavedEntries] = useState<WritingEntry[]>([]);
  const writingSectionRef = useRef<WritingSectionHandle>(null);

  // Load saved entries on mount
  useEffect(() => {
    fetch('/api/entries')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSavedEntries(data);
      })
      .catch(() => {});
  }, []);

  const fetchNarrative = useCallback(async (c: Concept) => {
    setNarrativeLoading(true);
    try {
      const elements = buildNarrativeElements(c);
      const res = await fetch('/api/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements }),
      });
      const data = await res.json();
      if (data.narrative) {
        setConcept((prev) =>
          prev && prev.id === c.id
            ? { ...prev, narrative: data.narrative }
            : prev
        );
      }
    } catch {
      // Silently fail
    } finally {
      setNarrativeLoading(false);
    }
  }, []);

  const handleGenerate = useCallback(() => {
    setConcept((prev) => {
      if (prev) {
        setHistory((h) => [...h, prev]);
      }
      return null;
    });

    const newConcept = generateConcept();
    setConcept(newConcept);

    writingSectionRef.current?.reset();

    if (narrativeMode) {
      fetchNarrative(newConcept);
    }
  }, [narrativeMode, fetchNarrative]);

  const handleReroll = useCallback(
    (path: string) => {
      if (!concept) return;
      const updated = rerollElement(concept, path);
      setConcept(updated);
      if (narrativeMode) {
        fetchNarrative(updated);
      }
    },
    [concept, narrativeMode, fetchNarrative]
  );

  const handleNarrativeToggle = useCallback(() => {
    setNarrativeMode((prev) => {
      const next = !prev;
      if (next && concept && !concept.narrative) {
        fetchNarrative(concept);
      }
      return next;
    });
  }, [concept, fetchNarrative]);

  const handleSave = useCallback(
    async (data: {
      opening_style: string | null;
      body: string;
      word_count: number;
      duration_seconds: number | null;
    }) => {
      if (!concept) return;

      try {
        // Save concept first
        const conceptRes = await fetch('/api/concepts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            concept_data: concept,
            summary_text: summaryHTML(concept),
            narrative: concept.narrative,
          }),
        });
        const conceptData = await conceptRes.json();

        // Save writing entry
        const entryRes = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            concept_id: conceptData.id,
            concept_summary: summaryHTML(concept),
            ...data,
          }),
        });
        const entryData = await entryRes.json();

        // Add to local state
        const newEntry: WritingEntry = {
          id: entryData.id,
          concept_id: conceptData.id,
          concept_summary: summaryHTML(concept),
          opening_style: data.opening_style,
          body: data.body,
          word_count: data.word_count,
          duration_seconds: data.duration_seconds,
          created_at: new Date().toISOString(),
        };
        setSavedEntries((prev) => [newEntry, ...prev]);
      } catch (error) {
        console.error('Save failed:', error);
      }
    },
    [concept]
  );

  return (
    <div className="app">
      <header className="header">
        <h1 className="header-title">Story Engine</h1>
        <hr className="header-rule" />
        <p className="header-sub">click any highlighted word to re-roll it</p>
      </header>

      <div className="controls">
        <button className="btn btn-gen" onClick={handleGenerate}>
          Generate
        </button>
        <button
          className={`btn btn-mode ${narrativeMode ? 'active' : ''}`}
          onClick={handleNarrativeToggle}
        >
          Narrative: {narrativeMode ? 'On' : 'Off'}
        </button>
      </div>

      <ConceptDisplay
        concept={concept}
        onReroll={handleReroll}
        narrativeMode={narrativeMode}
        narrativeLoading={narrativeLoading}
      />

      <WritingSection
        ref={writingSectionRef}
        concept={concept}
        onSave={handleSave}
      />

      <SavedEntries entries={savedEntries} />

      <ConceptHistory history={history} />

      <footer className="footer">
        <p>Created with ♥️ by Jason Shen</p>
      </footer>
    </div>
  );
}
