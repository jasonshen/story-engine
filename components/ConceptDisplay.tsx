'use client';

import { useRef, useEffect, useState } from 'react';
import { PenNib } from '@phosphor-icons/react';
import { Concept } from '@/lib/types';
import { stripArticle, vowelSound, theAgent, enginePlural } from '@/lib/grammar';
import ClickableElement from './ClickableElement';
import Kbd from './Kbd';

interface ConceptDisplayProps {
  concept: Concept | null;
  onReroll: (path: string) => void;
  onCreateNarrative: () => void;
  narrativeLoading: boolean;
  narrativeError?: string | null;
}

/** Hands out keyboard digits 1..9 then 0, in reading order. */
function keyCounter() {
  let n = 0;
  return () => {
    n += 1;
    return n <= 10 ? String(n % 10) : undefined;
  };
}

export function EmptyPage({ noun }: { noun: string }) {
  return (
    <div className="page-empty">
      <p className="page-empty-line">Press Generate to conjure a {noun}.</p>
      <p className="page-empty-hint">
        <span className="only-fine">
          Or press <kbd className="kbd kbd-inline">G</kbd>. Every underlined word can be re-rolled.
        </span>
        <span className="only-touch">Every underlined word can be re-rolled with a tap.</span>
      </p>
    </div>
  );
}

export function RerollHint() {
  return (
    <p className="reroll-hint">
      <span className="only-fine">Click an underlined word to re-roll it, or press its number.</span>
      <span className="only-touch">Tap an underlined word to re-roll it.</span>
    </p>
  );
}

export function Expansion({
  loading,
  text,
  error,
  onCreate,
  label,
  loadingLabel,
}: {
  loading: boolean;
  text: string | null | undefined;
  error?: string | null;
  onCreate: () => void;
  label: string;
  loadingLabel: string;
}) {
  if (loading) {
    return (
      <div className="expansion is-loading" aria-busy="true">
        <p className="expansion-status" role="status">
          {loadingLabel}
        </p>
        <div className="skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }
  if (text) {
    return (
      <div className="expansion">
        <p className="expansion-text">{text}</p>
      </div>
    );
  }
  return (
    <div className="expansion-action">
      <button type="button" className="btn btn-quiet" data-action="expand" onClick={onCreate}>
        <PenNib aria-hidden="true" />
        {label}
        <Kbd>N</Kbd>
      </button>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ConceptDisplay({
  concept,
  onReroll,
  onCreateNarrative,
  narrativeLoading,
  narrativeError,
}: ConceptDisplayProps) {
  // Track concept ID changes to trigger shuffle animation
  const prevIdRef = useRef<string | null>(null);
  const [shuffleKey, setShuffleKey] = useState(0);

  useEffect(() => {
    if (concept && concept.id !== prevIdRef.current) {
      prevIdRef.current = concept.id;
      setShuffleKey((k) => k + 1);
    }
  }, [concept]);

  if (!concept) return <EmptyPage noun="story" />;

  const key = keyCounter();

  return (
    <div className="prompt concept-enter">
      {/* Logline */}
      <p className="logline">
        {concept.agents.map((a, i) => (
          <span key={`agent-${i}`}>
            {i > 0 && ' and '}
            {a.aspect ? (
              <>
                {vowelSound(a.aspect.label) ? 'An ' : 'A '}
                <ClickableElement
                  text={a.aspect.label}
                  className="el-aspect"
                  onReroll={() => onReroll(`agents.${i}.aspect`)}
                  title="Re-roll trait"
                  cardType="aspect"
                  shuffleKey={shuffleKey}
                  shuffleDuration={500}
                  hotkey={key()}
                />{' '}
                <ClickableElement
                  text={stripArticle(a.agent.label)}
                  className="el-agent"
                  onReroll={() => onReroll(`agents.${i}.agent`)}
                  title="Re-roll character"
                  cardType="agent"
                  shuffleKey={shuffleKey}
                  shuffleDuration={600}
                  hotkey={key()}
                />
              </>
            ) : (
              <ClickableElement
                text={a.agent.label}
                className="el-agent"
                onReroll={() => onReroll(`agents.${i}.agent`)}
                title="Re-roll character"
                cardType="agent"
                shuffleKey={shuffleKey}
                shuffleDuration={600}
                hotkey={key()}
              />
            )}
          </span>
        ))}{' '}
        <ClickableElement
          text={enginePlural(concept.engine.label, concept.agents.length)}
          className="el-engine"
          onReroll={() => onReroll('engine')}
          title="Re-roll drive"
          cardType="engine"
          shuffleKey={shuffleKey}
          shuffleDuration={700}
          hotkey={key()}
        />{' '}
        {concept.anchors.map((a, i) => (
          <span key={`anchor-${i}`}>
            {i > 0 && ' and '}
            {a.aspect ? (
              <>
                {vowelSound(a.aspect.label) ? 'an ' : 'a '}
                <ClickableElement
                  text={a.aspect.label}
                  className="el-aspect"
                  onReroll={() => onReroll(`anchors.${i}.aspect`)}
                  title="Re-roll trait"
                  cardType="aspect"
                  shuffleKey={shuffleKey}
                  shuffleDuration={800}
                  hotkey={key()}
                />{' '}
                <ClickableElement
                  text={stripArticle(a.anchor.label)}
                  className="el-anchor"
                  onReroll={() => onReroll(`anchors.${i}.anchor`)}
                  title="Re-roll object"
                  cardType="anchor"
                  shuffleKey={shuffleKey}
                  shuffleDuration={900}
                  hotkey={key()}
                />
              </>
            ) : (
              <ClickableElement
                text={a.anchor.label}
                className="el-anchor"
                onReroll={() => onReroll(`anchors.${i}.anchor`)}
                title="Re-roll object"
                cardType="anchor"
                shuffleKey={shuffleKey}
                shuffleDuration={900}
                hotkey={key()}
              />
            )}
          </span>
        ))}
        {', '}
        <ClickableElement
          text={concept.conflict.label.replace(/^But /, 'but ')}
          className="el-conflict"
          onReroll={() => onReroll('conflict')}
          title="Re-roll conflict"
          cardType="conflict"
          shuffleKey={shuffleKey}
          shuffleDuration={1000}
          hotkey={key()}
        />
        {'.'}
      </p>

      {/* Backstories: no shuffle animation on generate */}
      {concept.agents.map((a, i) => {
        if (!a.backstory) return null;
        const bsText =
          a.backstory.engine.label.charAt(0).toLowerCase() + a.backstory.engine.label.slice(1);
        return (
          <p key={`bs-${i}`} className="backstory">
            {theAgent(a) + ' '}
            <ClickableElement
              text={bsText}
              className="el-bs-engine"
              onReroll={() => onReroll(`agents.${i}.backstory.engine`)}
              title="Re-roll backstory"
              cardType="backstory-engine"
              hotkey={key()}
            />{' '}
            {a.backstory.targetAspect ? (
              <>
                {vowelSound(a.backstory.targetAspect.label) ? 'an ' : 'a '}
                <ClickableElement
                  text={a.backstory.targetAspect.label}
                  className="el-aspect"
                  onReroll={() => onReroll(`agents.${i}.backstory.targetAspect`)}
                  title="Re-roll trait"
                  cardType="aspect"
                  hotkey={key()}
                />{' '}
                <ClickableElement
                  text={stripArticle(a.backstory.target.label)}
                  className="el-agent"
                  onReroll={() => onReroll(`agents.${i}.backstory.target`)}
                  title="Re-roll character"
                  cardType="agent"
                  hotkey={key()}
                />
              </>
            ) : (
              <ClickableElement
                text={a.backstory.target.label}
                className="el-agent"
                onReroll={() => onReroll(`agents.${i}.backstory.target`)}
                title="Re-roll character"
                cardType="agent"
                hotkey={key()}
              />
            )}
            {', '}
            <ClickableElement
              text={a.backstory.conflict.label.replace(/^And /, 'and ')}
              className="el-bs-conflict"
              onReroll={() => onReroll(`agents.${i}.backstory.conflict`)}
              title="Re-roll complication"
              cardType="backstory-conflict"
              hotkey={key()}
            />
            {'.'}
          </p>
        );
      })}

      <RerollHint />

      <Expansion
        loading={narrativeLoading}
        text={concept.narrative}
        error={narrativeError}
        onCreate={onCreateNarrative}
        label="Create Narrative"
        loadingLabel="Conjuring narrative..."
      />
    </div>
  );
}
