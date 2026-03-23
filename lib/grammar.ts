import { AgentEntry, AnchorEntry, Backstory, Card } from './types';

export function stripArticle(label: string): string {
  return label.replace(/^(An?\s+|The\s+)/i, '');
}

export function vowelSound(word: string): boolean {
  return /^[aeiou]/i.test(word);
}

export function withAspect(label: string, aspect: Card | null): string {
  if (!aspect) return label;
  const noun = stripArticle(label);
  return (vowelSound(aspect.label) ? 'An ' : 'A ') + aspect.label + ' ' + noun;
}

export function agentDisplayName(entry: AgentEntry): string {
  return withAspect(entry.agent.label, entry.aspect);
}

export function anchorDisplayName(entry: AnchorEntry): string {
  return withAspect(entry.anchor.label, entry.aspect);
}

export function theAgent(entry: AgentEntry): string {
  const noun = stripArticle(entry.agent.label);
  return entry.aspect
    ? 'The ' + entry.aspect.label + ' ' + noun
    : 'The ' + noun;
}

export function enginePlural(label: string, agentCount: number): string {
  if (agentCount > 1 && label.startsWith('Wants ')) {
    return label.replace(/^Wants /, 'Want ');
  }
  return label;
}

export function bsAnchorName(backstory: Backstory): string {
  if (!backstory.anchorAspect) return backstory.anchor.label;
  const noun = stripArticle(backstory.anchor.label);
  return (vowelSound(backstory.anchorAspect.label) ? 'an ' : 'a ') +
    backstory.anchorAspect.label + ' ' + noun;
}
