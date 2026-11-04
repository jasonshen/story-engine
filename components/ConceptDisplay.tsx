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
import { CardType, Concept } from '@/lib/types';
import { getRandomLabels } from '@/lib/data';
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
  /** Zero-based step of the staged deal (see STORY_STEPS) */
  stage: number;
  /** Card paths the writer has turned face-up */
  flipped: ReadonlySet<string>;
  onFlip: (path: string) => void;
  /** Every step dealt and every card turned over */
  complete: boolean;
}

/**
 * The story is dealt in five steps: who (trait + character), what they want
 * and the object or place, the conflict, the backstory, the complication.
 */
export const STORY_STEPS = 5;

export function storyStageOf(path: string): number {
  if (path.includes('backstory')) return path.endsWith('.conflict') ? 4 : 3;
  if (path === 'conflict') return 2;
  if (path === 'engine' || path.startsWith('anchors')) return 1;
  return 0;
}

/** Every card path present in a concept, in reading order. */
export function storyCardPaths(c: Concept): string[] {
  const paths: string[] = [];
  c.agents.forEach((a, i) => {
    if (a.aspect) paths.push(`agents.${i}.aspect`);
    paths.push(`agents.${i}.agent`);
  });
  paths.push('engine');
  c.anchors.forEach((a, i) => {
    if (a.aspect) paths.push(`anchors.${i}.aspect`);
    paths.push(`anchors.${i}.anchor`);
  });
  paths.push('conflict');
  c.agents.forEach((a, i) => {
    if (!a.backstory) return;
    const p = `agents.${i}.backstory`;
    paths.push(`${p}.engine`);
    if (a.backstory.targetAspect) paths.push(`${p}.targetAspect`);
    paths.push(`${p}.target`, `${p}.conflict`);
  });
  return paths;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function ConceptDisplay({
  concept,
  onReroll,
  onCreateNarrative,
  narrativeLoading,
  narrativeError = null,
  stage,
  flipped,
  onFlip,
  complete,
}: ConceptDisplayProps) {
  if (!concept) {
    return <EmptyDeck text="Press Deal or G to lay out a story." />;
  }

  // Deal order follows reading order within each step.
  const stepIndex = [0, 0, 0, 0, 0];
  const up = (path: string) => flipped.has(path);
  // Articles depend on the trait's first letter, so keep them neutral
  // until the trait is turned over.
  const article = (path: string, label: string, capital: boolean) => {
    const an = up(path) && vowelSound(label);
    return capital ? (an ? 'An ' : 'A ') : an ? 'an ' : 'a ';
  };

  const decoyFor = (path: string) => {
    const field = path.split('.').pop();
    const inBackstory = path.includes('backstory');
    const type: CardType =
      field === 'aspect' || field === 'targetAspect'
        ? 'aspect'
        : field === 'agent' || field === 'target'
          ? 'agent'
          : field === 'anchor'
            ? 'anchor'
            : field === 'engine'
              ? inBackstory ? 'backstory-engine' : 'engine'
              : inBackstory ? 'backstory-conflict' : 'conflict';
    const strip = type === 'agent' || type === 'anchor';
    return () => {
      const label = getRandomLabels(type, 1)[0] ?? '';
      return strip ? cap(stripArticle(label)) : cap(label);
    };
  };
  const card = (
    path: string,
    category: string,
    icon: Icon,
    value: string,
    variant: string,
    title: string
  ) => {
    const s = storyStageOf(path);
    if (s > stage) return null;
    return (
      <PlayCard
        key={`${concept.id}-${path}`}
        category={category}
        icon={icon}
        value={value}
        variant={variant}
        title={title}
        dealIndex={stepIndex[s]++}
        onReroll={() => onReroll(path)}
        randomLabel={decoyFor(path)}
        revealOnMount={false}
        startFaceDown={!up(path)}
        onFlip={() => onFlip(path)}
      />
    );
  };

  const word = (path: string, text: string, className: string, title: string) =>
    up(path) ? (
      <ClickableElement
        text={text}
        className={className}
        onReroll={() => onReroll(path)}
        title={title}
      />
    ) : (
      <span className="blank" role="img" aria-label="Not turned over yet" />
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
                {article(`agents.${i}.aspect`, a.aspect.label, true)}
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
                {article(`anchors.${i}.aspect`, a.aspect.label, false)}
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
        {stage >= 1 && concept.anchors.map((a, i) =>
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
        if (!a.backstory || stage < 3) return null;
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
                  {article(`${p}.targetAspect`, bs.targetAspect.label, false)}
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

      {complete && (
      <NarrativeBlock
        text={concept.narrative}
        loading={narrativeLoading}
        loadingText="Conjuring narrative..."
        error={narrativeError}
        buttonLabel="Create Narrative"
        icon={PenNibIcon}
        onCreate={onCreateNarrative}
      />
      )}
    </>
  );
}
