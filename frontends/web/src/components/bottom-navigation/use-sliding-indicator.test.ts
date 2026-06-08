// SPDX-License-Identifier: Apache-2.0

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSlidingIndicator } from './use-sliding-indicator';

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  bottom: top + height,
  height,
  left,
  right: left + width,
  toJSON: () => ({}),
  top,
  width,
  x: left,
  y: top,
});

const elementWithRect = <T extends HTMLElement>(left: number, top: number, width: number, height: number): T => ({
  getBoundingClientRect: () => rect(left, top, width, height),
}) as T;

describe('useSlidingIndicator', () => {
  it('positions the indicator from the active label bounds relative to the container', () => {
    const { result } = renderHook(() => useSlidingIndicator(1));

    act(() => {
      result.current.containerRef.current = elementWithRect<HTMLDivElement>(20, 10, 300, 80);
      result.current.labelRefs.current[1] = elementWithRect<HTMLSpanElement>(120, 50, 48, 20);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.indicatorStyle).toEqual({
      left: 100,
      top: 60,
      width: 48,
    });
  });

  it('clears the indicator when no tab is active', () => {
    const { result, rerender } = renderHook(
      ({ activeIndex }: { activeIndex: number | undefined }) => useSlidingIndicator(activeIndex),
      { initialProps: { activeIndex: 0 as number | undefined } }
    );

    act(() => {
      result.current.containerRef.current = elementWithRect<HTMLDivElement>(10, 12, 300, 80);
      result.current.labelRefs.current[0] = elementWithRect<HTMLSpanElement>(40, 46, 60, 20);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.indicatorStyle).toEqual({
      left: 30,
      top: 54,
      width: 60,
    });

    rerender({ activeIndex: undefined });

    expect(result.current.indicatorStyle).toBeUndefined();
  });
});
