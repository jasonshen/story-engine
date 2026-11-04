'use client';

import { createContext, useContext } from 'react';
import { DiceFive, X } from '@phosphor-icons/react';
import Kbd from './Kbd';

/** App-wide view state the per-tab workspaces need to read. */
export interface UiState {
  toolsOpen: boolean;
  closeTools: () => void;
}

export const UiContext = createContext<UiState>({
  toolsOpen: false,
  closeTools: () => {},
});

export function GenerateButton({
  onGenerate,
  rollKey,
  className = '',
}: {
  onGenerate: () => void;
  /** Changes on every generate (click or key) so the die tumbles each time */
  rollKey: number;
  className?: string;
}) {
  return (
    <button type="button" className={`btn btn-primary btn-generate ${className}`} onClick={onGenerate}>
      <span key={rollKey} className={`gen-icon ${rollKey > 0 ? 'is-rolling' : ''}`}>
        <DiceFive weight="bold" aria-hidden="true" />
      </span>
      Generate
      <Kbd>G</Kbd>
    </button>
  );
}

interface WorkspaceProps {
  /** The prompt, set like the opening of a book */
  prompt: React.ReactNode;
  /** The writing surface, flowing directly under the prompt */
  writing: React.ReactNode;
  /** Quiet margin column on desktop, bottom sheet on mobile */
  tools: React.ReactNode;
  toolsLabel: string;
}

export default function Workspace({ prompt, writing, tools, toolsLabel }: WorkspaceProps) {
  const { toolsOpen, closeTools } = useContext(UiContext);
  return (
    <div className="ws">
      <article className="ws-page">
        {prompt}
        {writing}
      </article>
      <div className="sheet-scrim" data-open={toolsOpen} onClick={closeTools} aria-hidden="true" />
      <aside className="ws-margin" data-open={toolsOpen} aria-label={toolsLabel}>
        <div className="ws-margin-head">
          <span>{toolsLabel}</span>
          <button type="button" className="icon-btn" onClick={closeTools} aria-label="Close tools">
            <X aria-hidden="true" />
          </button>
        </div>
        {tools}
      </aside>
    </div>
  );
}
