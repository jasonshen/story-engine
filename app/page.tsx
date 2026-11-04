'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Books, Info } from '@phosphor-icons/react';
import { Concept, WritingEntry } from '@/lib/types';
import { Character } from '@/lib/character-types';
import { generateConcept, rerollElement } from '@/lib/engine';
import {
  agentDisplayName,
  anchorDisplayName,
  enginePlural,
  bsTargetName,
} from '@/lib/grammar';
import ConceptDisplay from '@/components/ConceptDisplay';
import GenerateButton from '@/components/GenerateButton';
import WritingSection, { WritingSectionHandle } from '@/components/WritingSection';
import SavedEntries from '@/components/SavedEntries';
import ConceptHistory from '@/components/ConceptHistory';
import CharacterTab from '@/components/CharacterTab';
import CharacterHistory from '@/components/CharacterHistory';
import LibraryDrawer from '@/components/LibraryDrawer';

type Tab = 'story' | 'character';
const TABS: { id: Tab; label: string }[] = [
  { id: 'story', label: 'Story' },
  { id: 'character', label: 'Character' },
];
const TAB_KEY = 'story-engine-tab';

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
          bsTargetName(a.backstory)
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
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [characterHistory, setCharacterHistory] = useState<Character[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const libraryBtnRef = useRef<HTMLButtonElement>(null);
  const [savedEntries, setSavedEntries] = useState<WritingEntry[]>([]);
  const writingSectionRef = useRef<WritingSectionHandle>(null);
  const [tab, setTab] = useState<Tab>('story');

  // Remember the last tab (per-browser convenience only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (saved === 'story' || saved === 'character') setTab(saved);
    } catch {}
  }, []);

  const selectTab = useCallback((t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  }, []);

  const archiveCharacter = useCallback((c: Character) => {
    setCharacterHistory((h) => [...h, c]);
  }, []);

  const closeLibrary = useCallback(() => setLibraryOpen(false), []);

  const handleEntrySaved = useCallback((entry: WritingEntry) => {
    setSavedEntries((prev) => [entry, ...prev]);
  }, []);

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
    setNarrativeError(null);
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
      } else {
        setNarrativeError(data.error || 'Narrative failed.');
      }
    } catch {
      setNarrativeError('Narrative engine unavailable.');
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
    setNarrativeError(null);

    writingSectionRef.current?.reset();
  }, []);

  const handleReroll = useCallback(
    (path: string) => {
      if (!concept) return;
      const updated = rerollElement(concept, path);
      setConcept(updated);
    },
    [concept]
  );

  const handleCreateNarrative = useCallback(() => {
    if (concept && !concept.narrative && !narrativeLoading) {
      fetchNarrative(concept);
    }
  }, [concept, narrativeLoading, fetchNarrative]);

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
          // Fall back to a local id so the list stays keyed if the store is down
          id: entryData.id ?? `local-${Date.now()}`,
          concept_id: conceptData.id ?? null,
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

  const selectByKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const idx = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(idx + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    selectTab(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">Story Engine</div>
          <nav className="segmented tabs" role="tablist" aria-label="Mode" onKeyDown={selectByKey}>
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                className={`seg ${tab === t.id ? 'seg-active' : ''}`}
                onClick={() => selectTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <button
            ref={libraryBtnRef}
            type="button"
            className="btn-ghost library-btn"
            onClick={() => setLibraryOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={libraryOpen}
          >
            <Books size={18} aria-hidden="true" />
            <span className="library-btn-label">Library</span>
            <span className="count" aria-label={`${savedEntries.length} saved`}>
              {savedEntries.length}
            </span>
          </button>
        </div>
      </header>

      <main className="main">
        {/* Both tabs stay mounted so switching never loses a roll or a draft */}
        <div
          id="panel-story"
          role="tabpanel"
          aria-labelledby="tab-story"
          hidden={tab !== 'story'}
        >
          <div className="workspace">
            <section className="gen-pane" aria-label="Story generator">
              <div className="toolbar">
                <GenerateButton
                  onGenerate={handleGenerate}
                  hotkeyEnabled={tab === 'story' && !libraryOpen}
                />
                {concept && (
                  <p className="hint">
                    <Info size={15} aria-hidden="true" />
                    Click any highlighted word to re-roll it.
                  </p>
                )}
              </div>

              <ConceptDisplay
                concept={concept}
                onReroll={handleReroll}
                onCreateNarrative={handleCreateNarrative}
                narrativeLoading={narrativeLoading}
                narrativeError={narrativeError}
              />
            </section>

            <aside className="pad-pane" aria-label="Writing pad">
              <WritingSection
                ref={writingSectionRef}
                ready={!!concept}
                onSave={handleSave}
              />
            </aside>
          </div>
        </div>

        <div
          id="panel-character"
          role="tabpanel"
          aria-labelledby="tab-character"
          hidden={tab !== 'character'}
        >
          <CharacterTab
            onEntrySaved={handleEntrySaved}
            onArchive={archiveCharacter}
            active={tab === 'character' && !libraryOpen}
          />
        </div>
      </main>

      <LibraryDrawer
        open={libraryOpen}
        onClose={closeLibrary}
        returnFocusRef={libraryBtnRef}
        views={[
          {
            id: 'saved',
            label: 'Saved',
            count: savedEntries.length,
            content: <SavedEntries entries={savedEntries} />,
          },
          {
            id: 'concepts',
            label: 'Concepts',
            count: history.length,
            content: <ConceptHistory history={history} />,
          },
          {
            id: 'characters',
            label: 'Characters',
            count: characterHistory.length,
            content: <CharacterHistory history={characterHistory} />,
          },
        ]}
      />

      <footer className="footer">
        <p>Created with ♥️ by Jason Shen</p>
      </footer>
    </div>
  );
}
