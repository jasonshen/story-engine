'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Concept, WritingEntry } from '@/lib/types';
import { generateConcept, rerollElement } from '@/lib/engine';
import {
  agentDisplayName,
  anchorDisplayName,
  enginePlural,
  bsTargetName,
} from '@/lib/grammar';
import { MotionConfig } from 'motion/react';
import { BookOpenTextIcon, CardsIcon, UserFocusIcon } from '@phosphor-icons/react';
import ConceptDisplay, {
  STORY_GROUPS,
  storyCardPaths,
  storyStageOf,
} from '@/components/ConceptDisplay';
import DealControls from '@/components/DealControls';
import { dealProgress, useDealQueue } from '@/components/useDealQueue';
import WritingSection, { SaveResult, WritingSectionHandle } from '@/components/WritingSection';
import SavedEntries from '@/components/SavedEntries';
import ConceptHistory from '@/components/ConceptHistory';
import CharacterTab from '@/components/CharacterTab';

type Tab = 'story' | 'character';
const TABS: { id: Tab; label: string; icon: typeof CardsIcon }[] = [
  { id: 'story', label: 'Story', icon: BookOpenTextIcon },
  { id: 'character', label: 'Character', icon: UserFocusIcon },
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
  const [savedEntries, setSavedEntries] = useState<WritingEntry[]>([]);
  const writingSectionRef = useRef<WritingSectionHandle>(null);
  const [tab, setTab] = useState<Tab>('story');
  // The whole story is laid out as empty slots; cards deal in by group or
  // one at a time when their slot is tapped.
  const deal = useDealQueue<string>();
  const landedRef = useRef(deal.landed);
  landedRef.current = deal.landed;

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

  /** Lay out a fresh, empty table for a new story. */
  const handleGenerate = useCallback(() => {
    setConcept((prev) => {
      // Keep it in the history only if any of it was actually dealt.
      if (prev && landedRef.current.size > 0) {
        setHistory((h) => [...h, prev]);
      }
      return null;
    });

    const newConcept = generateConcept();
    setConcept(newConcept);
    deal.reset();
    setNarrativeError(null);

    writingSectionRef.current?.reset();
  }, [deal.reset]);

  // Shuffle the first story on load (client-side, so it is random per visit).
  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReroll = useCallback(
    (path: string) => {
      if (!concept) return;
      const updated = rerollElement(concept, path);
      setConcept(updated);
      setNarrativeError(null);
    },
    [concept]
  );

  const storyPaths = concept ? storyCardPaths(concept) : [];
  const progress = dealProgress(
    storyPaths,
    storyStageOf,
    STORY_GROUPS,
    deal.queued,
    deal.landed,
    deal.carried
  );
  const nextKeysRef = useRef(progress.nextKeys);
  nextKeysRef.current = progress.nextKeys;

  const handleDealNext = useCallback(() => {
    deal.queue(nextKeysRef.current);
  }, [deal.queue]);

  const handleRequestDeal = useCallback(
    (path: string) => deal.queue([path]),
    [deal.queue]
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
    }): Promise<SaveResult> => {
      if (!concept) return 'local';
      let conceptId: string | null = null;
      let entryId: string | undefined;
      let ok = false;

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
        conceptId = conceptData.id ?? null;

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
        entryId = entryData.id;
        ok = conceptRes.ok && entryRes.ok && !!entryId;
      } catch (error) {
        console.error('Save failed:', error);
      }

      // Add to local state either way, so the draft is never lost on this page
      const newEntry: WritingEntry = {
        id: entryId ?? `local-${Date.now()}`,
        concept_id: conceptId,
        concept_summary: summaryHTML(concept),
        opening_style: data.opening_style,
        body: data.body,
        word_count: data.word_count,
        duration_seconds: data.duration_seconds,
        created_at: new Date().toISOString(),
      };
      setSavedEntries((prev) => [newEntry, ...prev]);
      return ok ? 'saved' : 'local';
    },
    [concept]
  );

  const saved = <SavedEntries entries={savedEntries} />;

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <CardsIcon size={20} weight="fill" />
            </span>
            <h1 className="brand-name">Story Engine</h1>
          </div>

          <nav className="tabs" role="tablist" aria-label="Mode">
            {TABS.map((t) => {
              const TabIcon = t.icon;
              return (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  className={`tab ${tab === t.id ? 'tab-active' : ''}`}
                  onClick={() => selectTab(t.id)}
                >
                  <TabIcon size={18} weight={tab === t.id ? 'fill' : 'regular'} aria-hidden="true" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main>
          {/* Both tabs stay mounted so switching never loses a roll or a draft */}
          <div
            id="panel-story"
            role="tabpanel"
            aria-labelledby="tab-story"
            hidden={tab !== 'story'}
          >
            <div className="board">
              <div className="table">
                <div className="deal-bar">
                  <DealControls
                    started={progress.started}
                    complete={progress.complete}
                    dealing={progress.dealing}
                    nextName={progress.nextName}
                    dealtCount={progress.dealtCount}
                    total={progress.total}
                    onDealNext={handleDealNext}
                    onNewDeal={handleGenerate}
                    active={tab === 'story'}
                  />
                  <p className="table-hint table-hint--inline">
                    Tap an empty slot to deal just that card. Tap a dealt card, or an
                    underlined word, to re-roll it.
                  </p>
                </div>

                <ConceptDisplay
                  concept={concept}
                  onReroll={handleReroll}
                  onCreateNarrative={handleCreateNarrative}
                  narrativeLoading={narrativeLoading}
                  narrativeError={narrativeError}
                  queued={deal.queued}
                  landed={deal.landed}
                  onLanded={deal.land}
                  onRequestDeal={handleRequestDeal}
                  complete={progress.complete}
                />
              </div>

              <aside className="pad" aria-label="Writing pad">
                <WritingSection
                  ref={writingSectionRef}
                  ready={progress.dealtCount > 0}
                  onSave={handleSave}
                  emptyText="Deal a story, then write the opening here."
                />
              </aside>
            </div>

            <div className="drawers">
              {saved}
              <ConceptHistory history={history} />
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
              active={tab === 'character'}
              savedEntries={saved}
            />
          </div>
        </main>

        <footer className="footer">
          <p>Created with ♥️ by Jason Shen</p>
        </footer>
      </div>
    </MotionConfig>
  );
}
