// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';

type TProps = {
  enabled: boolean;
  page: number;
  duration: number;
  paused: boolean;
  onAdvance: () => void;
};

export const useAutoAdvance = ({ enabled, page, duration, paused, onAdvance }: TProps) => {
  const [hidden, setHidden] = useState(document.hidden);
  const remaining = useRef(duration);
  const advance = useRef(onAdvance);
  advance.current = onAdvance;
  const stopped = paused || hidden || !enabled;

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    remaining.current = duration;
  }, [page, duration]);

  useEffect(() => {
    if (stopped) {
      return;
    }
    const started = Date.now();
    const timeout = window.setTimeout(() => advance.current(), remaining.current);
    return () => {
      window.clearTimeout(timeout);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [page, duration, stopped]);

  return stopped;
};
