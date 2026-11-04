'use client';

import { motion } from 'motion/react';
import { WarningIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

interface NarrativeBlockProps {
  text: string | null;
  loading: boolean;
  loadingText: string;
  error?: string | null;
  buttonLabel: string;
  icon: Icon;
  onCreate: () => void;
}

/** The AI write-up under a spread: button, loading skeleton, result or error. */
export default function NarrativeBlock({
  text,
  loading,
  loadingText,
  error,
  buttonLabel,
  icon: BtnIcon,
  onCreate,
}: NarrativeBlockProps) {
  if (loading) {
    return (
      <div className="narrative narrative--loading" role="status">
        <span className="narrative-loading-label">{loadingText}</span>
        <span className="skeleton" />
        <span className="skeleton" />
        <span className="skeleton skeleton--short" />
      </div>
    );
  }
  if (text) {
    return (
      <motion.div
        className="narrative"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <p className="narrative-text">{text}</p>
      </motion.div>
    );
  }
  return (
    <div className="narrative-action">
      <button className="btn-secondary" onClick={onCreate} type="button">
        <BtnIcon size={18} weight="bold" aria-hidden="true" />
        {buttonLabel}
      </button>
      {error && (
        <p className="inline-error" role="alert">
          <WarningIcon size={16} weight="bold" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
