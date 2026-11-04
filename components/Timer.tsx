'use client';

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ArrowCounterClockwise, Pause, Play } from '@phosphor-icons/react';
import Kbd from './Kbd';

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
    const state = running ? 'running' : seconds === 0 ? 'done' : 'idle';
    const buttonLabel = running ? 'Stop' : seconds < 300 && !running ? 'Reset' : 'Start';
    const Icon = running ? Pause : buttonLabel === 'Reset' ? ArrowCounterClockwise : Play;

    return (
      <div className="timer" data-state={state}>
        <span className="timer-display" aria-live="off">
          {m}:{s < 10 ? '0' : ''}
          {s}
        </span>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          data-action="timer"
          aria-pressed={running}
          onClick={handleClick}
        >
          <Icon aria-hidden="true" />
          {buttonLabel}
          <Kbd>T</Kbd>
        </button>
        {state === 'done' && <span className="timer-note">Time&rsquo;s up.</span>}
      </div>
    );
  }
);

export default Timer;
