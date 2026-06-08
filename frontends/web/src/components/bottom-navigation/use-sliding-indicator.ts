// SPDX-License-Identifier: Apache-2.0

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export type TIndicatorStyle = {
  left: number;
  top: number;
  width: number;
};

const setIndicatorIfChanged = (
  setIndicatorStyle: (updater: (current: TIndicatorStyle | undefined) => TIndicatorStyle | undefined) => void,
  next: TIndicatorStyle | undefined,
) => {
  setIndicatorStyle(current => {
    if (current?.left === next?.left && current?.top === next?.top && current?.width === next?.width) {
      return current;
    }
    return next;
  });
};

export const useSlidingIndicator = (
  activeIndex: number | undefined,
  updateKey = '',
) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [indicatorStyle, setIndicatorStyle] = useState<TIndicatorStyle>();

  const updateIndicator = useCallback(() => {
    if (activeIndex === undefined) {
      setIndicatorIfChanged(setIndicatorStyle, undefined);
      return;
    }
    const container = containerRef.current;
    const label = labelRefs.current[activeIndex];
    if (!container || !label) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    setIndicatorIfChanged(setIndicatorStyle, {
      left: labelRect.left - containerRect.left,
      top: labelRect.bottom - containerRect.top,
      width: labelRect.width,
    });
  }, [activeIndex]);

  useLayoutEffect(() => {
    updateIndicator();
    const animationFrame = window.requestAnimationFrame(updateIndicator);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [updateIndicator, updateKey]);

  useLayoutEffect(() => {
    if (!('ResizeObserver' in window)) {
      return;
    }
    const resizeObserver = new ResizeObserver(updateIndicator);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    labelRefs.current.forEach(label => {
      if (label) {
        resizeObserver.observe(label);
      }
    });
    return () => resizeObserver.disconnect();
  }, [updateIndicator, updateKey]);

  useLayoutEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  return {
    containerRef,
    indicatorStyle,
    labelRefs,
  };
};
