import { getCardsByType } from './data';
import { Card, Concept, AgentEntry, AnchorEntry } from './types';

function pick(arr: Card[], exclude: string[] = []): Card {
  const pool = exclude.length ? arr.filter(x => !exclude.includes(x.id)) : arr;
  const source = pool.length ? pool : arr;
  return source[Math.floor(Math.random() * source.length)];
}

function maybe(p: number = 0.7): boolean {
  return Math.random() < p;
}

function pickAspect(exclude: string[] = []): Card | null {
  return maybe(0.7) ? pick(getCardsByType('aspect'), exclude) : null;
}

export function generateConcept(): Concept {
  const nAgents = maybe(0.6) ? 2 : 1;
  const nAnchors = maybe(0.5) ? 2 : 1;

  const concept: Concept = {
    id: Math.random().toString(36).slice(2),
    agents: [],
    engine: pick(getCardsByType('engine')),
    anchors: [],
    conflict: pick(getCardsByType('conflict')),
    narrative: null,
  };

  const usedAgentIds: string[] = [];
  const usedAnchorIds: string[] = [];
  const usedAspectIds: string[] = [];

  // Pick agents
  for (let i = 0; i < nAgents; i++) {
    const agent = pick(getCardsByType('agent'), usedAgentIds);
    usedAgentIds.push(agent.id);
    const aspect = pickAspect(usedAspectIds);
    if (aspect) usedAspectIds.push(aspect.id);
    concept.agents.push({ agent, aspect, backstory: null });
  }

  // Pick anchors
  for (let i = 0; i < nAnchors; i++) {
    const anchor = pick(getCardsByType('anchor'), usedAnchorIds);
    usedAnchorIds.push(anchor.id);
    const aspect = pickAspect(usedAspectIds);
    if (aspect) usedAspectIds.push(aspect.id);
    concept.anchors.push({ anchor, aspect });
  }

  // Build backstories for each agent (target is another agent, not an anchor)
  const usedBsTargetIds: string[] = [...usedAgentIds];
  for (const agentEntry of concept.agents) {
    const bsEngine = pick(getCardsByType('backstory-engine'));
    const bsTarget = pick(getCardsByType('agent'), usedBsTargetIds);
    usedBsTargetIds.push(bsTarget.id);
    const bsAspect = pickAspect(usedAspectIds);
    if (bsAspect) usedAspectIds.push(bsAspect.id);
    const bsConflict = pick(getCardsByType('backstory-conflict'));

    agentEntry.backstory = {
      engine: bsEngine,
      target: bsTarget,
      targetAspect: bsAspect,
      conflict: bsConflict,
    };
  }

  return concept;
}

export function rerollElement(concept: Concept, path: string): Concept {
  const c: Concept = JSON.parse(JSON.stringify(concept));
  const parts = path.split('.');

  const usedAnchorIds = (): string[] => {
    const ids: string[] = [];
    c.anchors.forEach(a => ids.push(a.anchor.id));
    return ids;
  };

  const usedBsTargetIds = (): string[] => {
    const ids: string[] = [];
    c.agents.forEach(a => ids.push(a.agent.id));
    c.agents.forEach(a => {
      if (a.backstory) ids.push(a.backstory.target.id);
    });
    return ids;
  };

  const usedAspectIds = (): string[] => {
    const ids: string[] = [];
    c.agents.forEach(a => {
      if (a.aspect) ids.push(a.aspect.id);
      if (a.backstory?.targetAspect) ids.push(a.backstory.targetAspect.id);
    });
    c.anchors.forEach(a => {
      if (a.aspect) ids.push(a.aspect.id);
    });
    return ids;
  };

  if (parts[0] === 'engine') {
    c.engine = pick(getCardsByType('engine'), [c.engine.id]);
  } else if (parts[0] === 'conflict') {
    c.conflict = pick(getCardsByType('conflict'), [c.conflict.id]);
  } else if (parts[0] === 'agents') {
    const i = +parts[1];
    const field = parts[2];

    if (field === 'agent') {
      c.agents[i].agent = pick(
        getCardsByType('agent'),
        c.agents.map(a => a.agent.id)
      );
    } else if (field === 'aspect') {
      c.agents[i].aspect = pickAspect(usedAspectIds());
    } else if (field === 'backstory' && c.agents[i].backstory) {
      const bsField = parts[3];
      const bs = c.agents[i].backstory!;

      if (bsField === 'engine') {
        bs.engine = pick(getCardsByType('backstory-engine'), [bs.engine.id]);
      } else if (bsField === 'target') {
        bs.target = pick(getCardsByType('agent'), usedBsTargetIds());
      } else if (bsField === 'targetAspect') {
        bs.targetAspect = pickAspect(usedAspectIds());
      } else if (bsField === 'conflict') {
        bs.conflict = pick(getCardsByType('backstory-conflict'), [bs.conflict.id]);
      }
    }
  } else if (parts[0] === 'anchors') {
    const i = +parts[1];
    const field = parts[2];

    if (field === 'anchor') {
      c.anchors[i].anchor = pick(getCardsByType('anchor'), usedAnchorIds());
    } else if (field === 'aspect') {
      c.anchors[i].aspect = pickAspect(usedAspectIds());
    }
  }

  c.narrative = null;
  return c;
}
