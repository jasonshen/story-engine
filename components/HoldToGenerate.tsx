'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface HoldToGenerateProps {
  onGenerate: () => void;
}

const HOLD_DURATION = 2000; // 2 seconds
const RADIUS = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function HoldToGenerate({ onGenerate }: HoldToGenerateProps) {
  const [state, setState] = useState<'idle' | 'filling' | 'unwinding'>('idle');
  const [progress, setProgress] = useState(0); // 0 to 1
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const unwindRafRef = useRef<number>(0);
  const hasCompletedRef = useRef(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(unwindRafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const animateFill = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const p = Math.min(elapsed / HOLD_DURATION, 1);
    setProgress(p);

    if (p >= 1) {
      hasCompletedRef.current = true;
      setState('idle');
      setProgress(0);
      onGenerate();
      return;
    }

    rafRef.current = requestAnimationFrame(animateFill);
  }, [onGenerate]);

  const animateUnwind = useCallback((startProgress: number, startTime: number) => {
    const unwindDuration = startProgress * 600; // proportional unwind, faster than fill
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / Math.max(unwindDuration, 100), 1);
    const currentProgress = startProgress * (1 - easeOutCubic(t));
    setProgress(currentProgress);

    if (t >= 1) {
      setProgress(0);
      setState('idle');
      return;
    }

    unwindRafRef.current = requestAnimationFrame(() =>
      animateUnwind(startProgress, startTime)
    );
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      hasCompletedRef.current = false;
      cancelAnimationFrame(unwindRafRef.current);
      startTimeRef.current = Date.now();
      setState('filling');
      rafRef.current = requestAnimationFrame(animateFill);
    },
    [animateFill]
  );

  const handlePointerUp = useCallback(() => {
    if (state !== 'filling' || hasCompletedRef.current) return;
    cancelAnimationFrame(rafRef.current);
    const currentProgress = progress;
    setState('unwinding');
    animateUnwind(currentProgress, Date.now());
  }, [state, progress, animateUnwind]);

  const handlePointerCancel = handlePointerUp;
  const handlePointerLeave = handlePointerUp;

  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <button
      className={`hold-btn ${state !== 'idle' ? 'hold-btn-active' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      type="button"
    >
      <svg
        className="hold-btn-svg"
        viewBox="0 0 64 64"
        width="64"
        height="64"
      >
        {/* Background circle */}
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="3"
        />
        {/* Progress ring */}
        <circle
          className="hold-btn-ring"
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="hold-btn-label">Generate</span>
    </button>
  );
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
