'use client';

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';

export interface TimerHandle {
  reset: () => void;
}

const Timer = forwardRef<TimerHandle, { onStart?: () => void }>(
  function Timer({ onStart }, ref) {
    const [seconds, setSeconds] = useState(300);
    const [running, setRunning] = useState(false);

    useImperativeHandle(ref, () => ({
      reset: () => {
        setSeconds(300);
        setRunning(false);
      },
    }));

    useEffect(() => {
      if (!running) return;
      const interval = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            setRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }, [running]);

    const handleClick = useCallback(() => {
      if (running) {
        // Stop
        setRunning(false);
      } else if (seconds === 0 || (!running && seconds < 300 && seconds > 0)) {
        // Reset
        setSeconds(300);
      } else {
        // Start
        setRunning(true);
        onStart?.();
      }
    }, [running, seconds, onStart]);

    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const displayClass = running
      ? 'timer-display running'
      : seconds === 0
        ? 'timer-display done'
        : 'timer-display';

    const buttonLabel = running ? 'Stop' : seconds < 300 && !running ? 'Reset' : 'Start';

    return (
      <div className="timer-area">
        <span className={displayClass}>
          {m}:{s < 10 ? '0' : ''}{s}
        </span>
        <button
          className={`btn-timer ${running ? 'active-timer' : ''}`}
          onClick={handleClick}
        >
          {buttonLabel}
        </button>
      </div>
    );
  }
);

export default Timer;
