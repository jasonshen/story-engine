'use client';

import { Concept } from '@/lib/types';
import { stripArticle, vowelSound, theAgent, enginePlural } from '@/lib/grammar';
import ClickableElement from './ClickableElement';

interface ConceptDisplayProps {
  concept: Concept | null;
  onReroll: (path: string) => void;
  onCreateNarrative: () => void;
  narrativeLoading: boolean;
}

export default function ConceptDisplay({
  concept,
  onReroll,
  onCreateNarrative,
  narrativeLoading,
}: ConceptDisplayProps) {
  if (!concept) {
    return (
      <div className="concept">
        <div className="concept-empty">
          <span className="glyph">&#x273B;</span>
          Press generate to conjure a story
        </div>
      </div>
    );
  }

  return (
    <div className="concept">
      <div className="concept-enter">
        {/* Logline */}
        <div className="logline">
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
                  />{' '}
                  <ClickableElement
                    text={stripArticle(a.agent.label)}
                    className="el-agent"
                    onReroll={() => onReroll(`agents.${i}.agent`)}
                    title="Re-roll character"
                  />
                </>
              ) : (
                <ClickableElement
                  text={a.agent.label}
                  className="el-agent"
                  onReroll={() => onReroll(`agents.${i}.agent`)}
                  title="Re-roll character"
                />
              )}
            </span>
          ))}{' '}
          <ClickableElement
            text={enginePlural(concept.engine.label, concept.agents.length)}
            className="el-engine"
            onReroll={() => onReroll('engine')}
            title="Re-roll drive"
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
                  />{' '}
                  <ClickableElement
                    text={stripArticle(a.anchor.label)}
                    className="el-anchor"
                    onReroll={() => onReroll(`anchors.${i}.anchor`)}
                    title="Re-roll object"
                  />
                </>
              ) : (
                <ClickableElement
                  text={a.anchor.label}
                  className="el-anchor"
                  onReroll={() => onReroll(`anchors.${i}.anchor`)}
                  title="Re-roll object"
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
          />
          {'.'}
        </div>

        {/* Divider */}
        <hr className="concept-divider" />

        {/* Backstories */}
        {concept.agents.map((a, i) => {
          if (!a.backstory) return null;
          const bsText =
            a.backstory.engine.label.charAt(0).toLowerCase() +
            a.backstory.engine.label.slice(1);
          return (
            <div key={`bs-${i}`} className="backstory-block">
              <div className="backstory-sentence">
                {theAgent(a) + ' '}
                <ClickableElement
                  text={bsText}
                  className="el-bs-engine"
                  onReroll={() => onReroll(`agents.${i}.backstory.engine`)}
                  title="Re-roll backstory"
                />{' '}
                {a.backstory.anchorAspect ? (
                  <>
                    {vowelSound(a.backstory.anchorAspect.label) ? 'an ' : 'a '}
                    <ClickableElement
                      text={a.backstory.anchorAspect.label}
                      className="el-aspect"
                      onReroll={() =>
                        onReroll(`agents.${i}.backstory.anchorAspect`)
                      }
                      title="Re-roll trait"
                    />{' '}
                    <ClickableElement
                      text={stripArticle(a.backstory.anchor.label)}
                      className="el-anchor"
                      onReroll={() =>
                        onReroll(`agents.${i}.backstory.anchor`)
                      }
                      title="Re-roll object"
                    />
                  </>
                ) : (
                  <ClickableElement
                    text={a.backstory.anchor.label}
                    className="el-anchor"
                    onReroll={() =>
                      onReroll(`agents.${i}.backstory.anchor`)
                    }
                    title="Re-roll object"
                  />
                )}
                {', '}
                <ClickableElement
                  text={a.backstory.conflict.label.replace(/^And /, 'and ')}
                  className="el-bs-conflict"
                  onReroll={() =>
                    onReroll(`agents.${i}.backstory.conflict`)
                  }
                  title="Re-roll complication"
                />
                {'.'}
              </div>
            </div>
          );
        })}

        {/* Narrative */}
        {narrativeLoading && (
          <div className="narrative">
            <div className="narrative-text narrative-loading">
              Conjuring narrative...
            </div>
          </div>
        )}
        {!narrativeLoading && concept.narrative && (
          <div className="narrative">
            <div className="narrative-text">{concept.narrative}</div>
          </div>
        )}
        {!narrativeLoading && !concept.narrative && (
          <div className="narrative-action">
            <button
              className="btn btn-narrative"
              onClick={onCreateNarrative}
              type="button"
            >
              Create Narrative
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
