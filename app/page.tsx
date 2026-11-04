'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Archive,
  CornersIn,
  CornersOut,
  IconContext,
  Keyboard,
  SlidersHorizontal,
} from '@phosphor-icons/react';
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
import { useWriting, WritingSheet, WritingTools, SavePayload } from '@/components/WritingSection';
import CharacterTab, { CharacterTabHandle } from '@/components/CharacterTab';
import Workspace, { GenerateButton, UiContext } from '@/components/Workspace';
import ArchivePanel from '@/components/ArchivePanel';
import KeysList from '@/components/KeysList';
import Kbd from '@/components/Kbd';

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

/** Clicks the element matching `selector` inside `root`, if there is one. */
function clickIn(root: HTMLElement | null, selector: string): boolean {
  const el = root?.querySelector<HTMLElement>(selector);
  if (!el) return false;
  el.click();
  return true;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return (
    t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable
  );
}

const ICONS = { size: 18, weight: 'regular' as const, mirrored: false, color: 'currentColor' };

export default function Home() {
  const [concept, setConcept] = useState<Concept | null>(null);
  const [history, setHistory] = useState<Concept[]>([]);
  const [characterHistory, setCharacterHistory] = useState<Character[]>([]);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [savedEntries, setSavedEntries] = useState<WritingEntry[]>([]);
  const [storyRoll, setStoryRoll] = useState(0);
  const [barRoll, setBarRoll] = useState(0);
  const storyWriting = useWriting();
  const resetStoryWriting = storyWriting.reset;
  const characterRef = useRef<CharacterTabHandle>(null);
  const storyPanelRef = useRef<HTMLDivElement>(null);
  const characterPanelRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>('story');

  // View state: the chrome around the page, never the content itself
  const [focus, setFocus] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // Remember the last tab (per-browser convenience only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (saved === 'story' || saved === 'character') setTab(saved);
    } catch {}
  }, []);

  const selectTab = useCallback((t: Tab) => {
    setTab(t);
    setToolsOpen(false);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  }, []);

  const handleEntrySaved = useCallback((entry: WritingEntry) => {
    setSavedEntries((prev) => [entry, ...prev]);
  }, []);

  const handleCharacterArchived = useCallback((prev: Character) => {
    setCharacterHistory((h) => [...h, prev]);
  }, []);

  // Load saved entries on mount (with no database the API errors and the archive stays empty)
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
          prev && prev.id === c.id ? { ...prev, narrative: data.narrative } : prev
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
    setStoryRoll((k) => k + 1);

    resetStoryWriting();
  }, [resetStoryWriting]);

  const handleReroll = useCallback(
    (path: string) => {
      if (!concept) return;
      const updated = rerollElement(concept, path);
      setConcept(updated);
      setNarrativeError(null);
    },
    [concept]
  );

  const handleCreateNarrative = useCallback(() => {
    if (concept && !concept.narrative && !narrativeLoading) {
      fetchNarrative(concept);
    }
  }, [concept, narrativeLoading, fetchNarrative]);

  const handleSave = useCallback(
    async (data: SavePayload) => {
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
          // Without a database the API returns no id; keep the entry usable locally.
          id: entryData.id ?? `local-${Date.now()}`,
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

  const generateActive = useCallback(() => {
    if (tab === 'story') handleGenerate();
    else characterRef.current?.generate();
  }, [tab, handleGenerate]);

  const handleBarGenerate = useCallback(() => {
    setBarRoll((k) => k + 1);
    generateActive();
  }, [generateActive]);

  // Keyboard-first: one listener for the whole app, ignored while typing.
  const viewRef = useRef({ tab, focus, archiveOpen, keysOpen, toolsOpen, generateActive });
  viewRef.current = { tab, focus, archiveOpen, keysOpen, toolsOpen, generateActive };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = viewRef.current;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (v.archiveOpen) setArchiveOpen(false);
        else if (v.keysOpen) setKeysOpen(false);
        else if (v.toolsOpen) setToolsOpen(false);
        else if (v.focus) setFocus(false);
        else return;
        e.preventDefault();
        return;
      }

      if (isTypingTarget(e.target) || e.repeat) return;
      if (v.archiveOpen) {
        if (e.key.toLowerCase() === 'a' && !e.shiftKey) {
          e.preventDefault();
          setArchiveOpen(false);
        }
        return;
      }

      const panel = v.tab === 'story' ? storyPanelRef.current : characterPanelRef.current;

      if (/^Digit\d$/.test(e.code)) {
        const d = e.code.slice(5);
        const hit = e.shiftKey
          ? clickIn(panel, `[data-lock-key="${d}"]`)
          : clickIn(panel, `[data-key="${d}"]`);
        if (hit) e.preventDefault();
        return;
      }

      const k = e.key.toLowerCase();
      if (k === '?') {
        e.preventDefault();
        setKeysOpen((o) => !o);
        return;
      }
      if (e.shiftKey) return;

      switch (k) {
        case 'g':
          e.preventDefault();
          v.generateActive();
          break;
        case 'n':
          if (clickIn(panel, '[data-action="expand"]')) e.preventDefault();
          break;
        case 't':
          if (clickIn(panel, '[data-action="timer"]')) e.preventDefault();
          break;
        case 'w': {
          const ta = panel?.querySelector<HTMLTextAreaElement>('textarea');
          if (ta) {
            e.preventDefault();
            ta.focus();
            ta.setSelectionRange(ta.value.length, ta.value.length);
          }
          break;
        }
        case 'f':
          e.preventDefault();
          setFocus((f) => !f);
          setKeysOpen(false);
          break;
        case 'a':
          e.preventDefault();
          setKeysOpen(false);
          setArchiveOpen(true);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close the keys popover on any outside click
  const keysWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!keysOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!keysWrapRef.current?.contains(e.target as Node)) setKeysOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [keysOpen]);

  const ui = useMemo(() => ({ toolsOpen, closeTools: () => setToolsOpen(false) }), [toolsOpen]);

  const archiveCount =
    savedEntries.length + (tab === 'story' ? history.length : characterHistory.length);

  const storyTools = (
    <>
      <div className="tool tool-generate">
        <GenerateButton onGenerate={handleGenerate} rollKey={storyRoll} />
      </div>
      {concept ? <WritingTools w={storyWriting} ready /> : <KeysList compact tab="story" />}
    </>
  );

  return (
    <IconContext.Provider value={ICONS}>
      <UiContext.Provider value={ui}>
        <div className="app" data-focus={focus}>
          <header className="topbar">
            <div className="topbar-inner">
              <h1 className="wordmark">Story Engine</h1>

              <nav className="tabs" role="tablist" aria-label="Mode">
                {TABS.map((t) => (
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
                    {t.label}
                  </button>
                ))}
              </nav>

              <div className="topbar-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setArchiveOpen(true)}
                  aria-haspopup="dialog"
                >
                  <Archive aria-hidden="true" />
                  Archive
                  {archiveCount > 0 && <span className="count">{archiveCount}</span>}
                  <Kbd>A</Kbd>
                </button>
                <div className="keys-wrap" ref={keysWrapRef}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-expanded={keysOpen}
                    aria-controls="keys-pop"
                    onClick={() => setKeysOpen((o) => !o)}
                  >
                    <Keyboard aria-hidden="true" />
                    Keys
                    <Kbd>?</Kbd>
                  </button>
                  {keysOpen && (
                    <div className="keys-pop" id="keys-pop">
                      <KeysList tab={tab} />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-pressed={focus}
                  onClick={() => setFocus((f) => !f)}
                >
                  <CornersOut aria-hidden="true" />
                  Focus
                  <Kbd>F</Kbd>
                </button>
              </div>
            </div>
          </header>

          <main className="main">
            {/* Both tabs stay mounted so switching never loses a roll or a draft */}
            <div
              ref={storyPanelRef}
              id="panel-story"
              role="tabpanel"
              aria-labelledby="tab-story"
              hidden={tab !== 'story'}
            >
              <Workspace
                toolsLabel="Story tools"
                prompt={
                  <ConceptDisplay
                    concept={concept}
                    onReroll={handleReroll}
                    onCreateNarrative={handleCreateNarrative}
                    narrativeLoading={narrativeLoading}
                    narrativeError={narrativeError}
                  />
                }
                writing={<WritingSheet w={storyWriting} ready={!!concept} onSave={handleSave} />}
                tools={storyTools}
              />
            </div>

            <div
              ref={characterPanelRef}
              id="panel-character"
              role="tabpanel"
              aria-labelledby="tab-character"
              hidden={tab !== 'character'}
            >
              <CharacterTab
                ref={characterRef}
                onEntrySaved={handleEntrySaved}
                onArchive={handleCharacterArchived}
              />
            </div>
          </main>

          <footer className="footer">
            <p>Created with ♥️ by Jason Shen</p>
          </footer>

          {/* Phone toolbar */}
          <nav className="bottombar" aria-label="Toolbar">
            <button
              type="button"
              className="bar-btn"
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((o) => !o)}
            >
              <SlidersHorizontal aria-hidden="true" />
              Tools
            </button>
            <button type="button" className="bar-btn" onClick={() => setArchiveOpen(true)}>
              <Archive aria-hidden="true" />
              Archive
            </button>
            <button type="button" className="bar-btn" onClick={() => setFocus(true)}>
              <CornersOut aria-hidden="true" />
              Focus
            </button>
            <GenerateButton
              onGenerate={handleBarGenerate}
              rollKey={barRoll}
              className="bar-generate"
            />
          </nav>

          <button type="button" className="focus-exit" onClick={() => setFocus(false)}>
            <CornersIn aria-hidden="true" />
            Exit focus
            <Kbd>Esc</Kbd>
          </button>

          <ArchivePanel
            open={archiveOpen}
            onClose={() => setArchiveOpen(false)}
            tab={tab}
            entries={savedEntries}
            storyHistory={history}
            characterHistory={characterHistory}
          />
        </div>
      </UiContext.Provider>
    </IconContext.Provider>
  );
}
