'use client';

import { useId, useState } from 'react';
import { motion } from 'motion/react';
import { CaretRightIcon } from '@phosphor-icons/react';

interface DrawerProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** A compact collapsible panel used for saved entries and history. */
export default function Drawer({ title, count, defaultOpen = false, children }: DrawerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <section className={`drawer ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="drawer-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <CaretRightIcon className="drawer-caret" size={16} weight="bold" aria-hidden="true" />
        <span className="drawer-title">{title}</span>
        {count !== undefined && <span className="drawer-count">{count}</span>}
      </button>
      {open && (
        <motion.div
          id={id}
          className="drawer-body"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        >
          {children}
        </motion.div>
      )}
    </section>
  );
}
