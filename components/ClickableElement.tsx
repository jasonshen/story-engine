'use client';

import { useCallback, useRef } from 'react';

interface ClickableElementProps {
  text: string;
  className: string;
  onReroll: () => void;
  title?: string;
}

export default function ClickableElement({
  text,
  className,
  onReroll,
  title = 'Click to re-roll',
}: ClickableElementProps) {
  const spanRef = useRef<HTMLSpanElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const span = spanRef.current;
      if (!span) return;
      span.classList.add('el-swapping');
      setTimeout(() => {
        onReroll();
        span.classList.remove('el-swapping');
      }, 170);
    },
    [onReroll]
  );

  return (
    <span
      ref={spanRef}
      className={`el ${className}`}
      onClick={handleClick}
      title={title}
    >
      {text}
    </span>
  );
}
