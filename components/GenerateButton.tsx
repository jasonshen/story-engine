'use client';

import { useCallback, useEffect, useState } from 'react';
import { DiceFive } from '@phosphor-icons/react';

interface GenerateButtonProps {
  onGenerate: () => void;
  /** Listen for the G shortcut (only the visible tab should) */
  hotkeyEnabled: boolean;
  label?: string;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
}

/** One click (or G) generates. The die gives a short roll as feedback. */
export default function GenerateButton({
  onGenerate,
  hotkeyEnabled,
  label = 'Generate',
}: GenerateButtonProps) {
  const [rolls, setRolls] = useState(0);

  const fire = useCallback(() => {
    setRolls((r) => r + 1);
    onGenerate();
  }, [onGenerate]);

  useEffect(() => {
    if (!hotkeyEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'g' && e.key !== 'G') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      fire();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkeyEnabled, fire]);

  return (
    <button
      type="button"
      className="btn-generate"
      onClick={fire}
      aria-keyshortcuts="G"
      title="Generate (G)"
    >
      <span key={rolls} className={`gen-die ${rolls > 0 ? 'gen-die-roll' : ''}`}>
        <DiceFive size={18} weight="bold" aria-hidden="true" />
      </span>
      <span>{label}</span>
      <kbd className="kbd kbd-on-accent" aria-hidden="true">
        G
      </kbd>
    </button>
  );
}
