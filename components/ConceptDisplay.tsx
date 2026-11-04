'use client';

import {
  ArrowsSplitIcon,
  ClockCounterClockwiseIcon,
  FingerprintIcon,
  KeyIcon,
  LightningIcon,
  PenNibIcon,
  SwordIcon,
  UserIcon,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { Concept } from '@/lib/types';
import { stripArticle, vowelSound, theAgent, enginePlural } from '@/lib/grammar';
import ClickableElement from './ClickableElement';
import PlayCard from './PlayCard';
import EmptyDeck from './EmptyDeck';
import NarrativeBlock from './NarrativeBlock';

interface ConceptDisplayProps {
  concept: Concept | null;
  onReroll: (path: string) => void;
  onCreateNarrative: () => void;
  narrativeLoading: boolean;
  narrativeError?: string | null;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function ConceptDisplay({
  concept,
  onReroll,
  onCreateNarrative,
  narrativeLoading,
  narrativeError = null,
}: ConceptDisplayProps) {
  if (!concept) {
    return <EmptyDeck text="Press Deal or G to lay out a story." />;
  }

  // Deal order follows reading order so cards land left to right.
  let dealIndex = 0;
  const card = (
    path: string,
    category: string,
    icon: Icon,
    value: string,
    variant: string,
    title: string
  ) => (
    <PlayCard
      key={`${concept.id}-${path}`}
      category={category}
      icon={icon}
      value={value}
      variant={variant}
      title={title}
      dealIndex={dealIndex++}
      onReroll={() => onReroll(path)}
    />
  );

  const word = (path: string, text: string, className: string, title: string) => (
    <ClickableElement
      text={text}
      className={className}
      onReroll={() => onReroll(path)}
      title={title}
    />
  );

  return (
    <>
      {/* The assembled prompt, as prose */}
      <p className="logline">
        {concept.agents.map((a, i) => (
          <span key={`agent-${i}`}>
            {i > 0 && ' and '}
            {a.aspect ? (
              <>
                {vowelSound(a.aspect.label) ? 'An ' : 'A '}
                {word(`agents.${i}.aspect`, a.aspect.label, 'el-aspect', 'Re-roll trait')}{' '}
                {word(`agents.${i}.agent`, stripArticle(a.agent.label), 'el-agent', 'Re-roll character')}
              </>
            ) : (
              word(`agents.${i}.agent`, a.agent.label, 'el-agent', 'Re-roll character')
            )}
          </span>
        ))}{' '}
        {word(
          'engine',
          enginePlural(concept.engine.label, concept.agents.length),
          'el-engine',
          'Re-roll drive'
        )}{' '}
        {concept.anchors.map((a, i) => (
          <span key={`anchor-${i}`}>
            {i > 0 && ' and '}
            {a.aspect ? (
              <>
                {vowelSound(a.aspect.label) ? 'an ' : 'a '}
                {word(`anchors.${i}.aspect`, a.aspect.label, 'el-aspect', 'Re-roll trait')}{' '}
                {word(`anchors.${i}.anchor`, stripArticle(a.anchor.label), 'el-anchor', 'Re-roll object')}
              </>
            ) : (
              word(`anchors.${i}.anchor`, a.anchor.label, 'el-anchor', 'Re-roll object')
            )}
          </span>
        ))}
        {', '}
        {word(
          'conflict',
          concept.conflict.label.replace(/^But /, 'but '),
          'el-conflict',
          'Re-roll conflict'
        )}
        {'.'}
      </p>

      {/* The spread */}
      <div className="spread spread--story">
        {concept.agents.map((a, i) =>
          a.aspect ? (
            <div className="pair" key={`${concept.id}-pair-agent-${i}`}>
              {card(`agents.${i}.aspect`, 'Trait', FingerprintIcon, cap(a.aspect.label), 'trait', 'Re-roll trait')}
              {card(`agents.${i}.agent`, 'Character', UserIcon, cap(stripArticle(a.agent.label)), 'agent', 'Re-roll character')}
            </div>
          ) : (
            card(`agents.${i}.agent`, 'Character', UserIcon, cap(stripArticle(a.agent.label)), 'agent', 'Re-roll character')
          )
        )}
        {card(
          'engine',
          'Drive',
          LightningIcon,
          enginePlural(concept.engine.label, concept.agents.length),
          'engine',
          'Re-roll drive'
        )}
        {concept.anchors.map((a, i) =>
          a.aspect ? (
            <div className="pair" key={`${concept.id}-pair-anchor-${i}`}>
              {card(`anchors.${i}.aspect`, 'Trait', FingerprintIcon, cap(a.aspect.label), 'trait', 'Re-roll trait')}
              {card(`anchors.${i}.anchor`, 'Object or place', KeyIcon, cap(stripArticle(a.anchor.label)), 'anchor', 'Re-roll object')}
            </div>
          ) : (
            card(`anchors.${i}.anchor`, 'Object or place', KeyIcon, cap(stripArticle(a.anchor.label)), 'anchor', 'Re-roll object')
          )
        )}
        {card('conflict', 'Conflict', SwordIcon, concept.conflict.label, 'conflict', 'Re-roll conflict')}
      </div>

      {/* Backstories: a second, smaller row of cards per character */}
      {concept.agents.map((a, i) => {
        if (!a.backstory) return null;
        const bs = a.backstory;
        const bsText = bs.engine.label.charAt(0).toLowerCase() + bs.engine.label.slice(1);
        const p = `agents.${i}.backstory`;
        return (
          <section key={`bs-${i}`} className="tray" aria-label={`Backstory for ${theAgent(a)}`}>
            <p className="tray-prose">
              <span className="tray-label">Backstory</span>
              {theAgent(a) + ' '}
              {word(`${p}.engine`, bsText, 'el-bs-engine', 'Re-roll backstory')}{' '}
              {bs.targetAspect ? (
                <>
                  {vowelSound(bs.targetAspect.label) ? 'an ' : 'a '}
                  {word(`${p}.targetAspect`, bs.targetAspect.label, 'el-aspect', 'Re-roll trait')}{' '}
                  {word(`${p}.target`, stripArticle(bs.target.label), 'el-agent', 'Re-roll character')}
                </>
              ) : (
                word(`${p}.target`, bs.target.label, 'el-agent', 'Re-roll character')
              )}
              {', '}
              {word(
                `${p}.conflict`,
                bs.conflict.label.replace(/^And /, 'and '),
                'el-bs-conflict',
                'Re-roll complication'
              )}
              {'.'}
            </p>
            <div className="spread spread--backstory">
              {card(`${p}.engine`, 'Backstory', ClockCounterClockwiseIcon, cap(bsText), 'bs-engine', 'Re-roll backstory')}
              {bs.targetAspect ? (
                <div className="pair">
                  {card(`${p}.targetAspect`, 'Trait', FingerprintIcon, cap(bs.targetAspect.label), 'trait', 'Re-roll trait')}
                  {card(`${p}.target`, 'Character', UserIcon, cap(stripArticle(bs.target.label)), 'bs-agent', 'Re-roll character')}
                </div>
              ) : (
                card(`${p}.target`, 'Character', UserIcon, cap(stripArticle(bs.target.label)), 'bs-agent', 'Re-roll character')
              )}
              {card(`${p}.conflict`, 'Complication', ArrowsSplitIcon, bs.conflict.label, 'bs-conflict', 'Re-roll complication')}
            </div>
          </section>
        );
      })}

      <NarrativeBlock
        text={concept.narrative}
        loading={narrativeLoading}
        loadingText="Conjuring narrative..."
        error={narrativeError}
        buttonLabel="Create Narrative"
        icon={PenNibIcon}
        onCreate={onCreateNarrative}
      />
    </>
  );
}
