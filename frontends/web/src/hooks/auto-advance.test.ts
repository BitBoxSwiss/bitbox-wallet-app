// SPDX-License-Identifier: Apache-2.0

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoAdvance } from './auto-advance';

describe('useAutoAdvance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('preserves remaining time while paused and resets it on a new page', () => {
    const onAdvance = vi.fn();
    const { rerender } = renderHook(({ paused, page }) => useAutoAdvance({
      enabled: true, duration: 8000, paused, page, onAdvance,
    }), { initialProps: { paused: false, page: 0 } });
    act(() => vi.advanceTimersByTime(3000));
    rerender({ paused: true, page: 0 });
    act(() => vi.advanceTimersByTime(10000));
    expect(onAdvance).not.toHaveBeenCalled();
    rerender({ paused: false, page: 0 });
    act(() => vi.advanceTimersByTime(4999));
    expect(onAdvance).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onAdvance).toHaveBeenCalledTimes(1);
    rerender({ paused: false, page: 1 });
    act(() => vi.advanceTimersByTime(7999));
    expect(onAdvance).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(onAdvance).toHaveBeenCalledTimes(2);
  });

  it('pauses in the background and cleans up on unmount', () => {
    const onAdvance = vi.fn();
    const { result, unmount } = renderHook(() => useAutoAdvance({
      enabled: true, duration: 8000, paused: false, page: 0, onAdvance,
    }));
    act(() => vi.advanceTimersByTime(2000));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(10000));
    expect(onAdvance).not.toHaveBeenCalled();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(5999));
    expect(onAdvance).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onAdvance).toHaveBeenCalledTimes(1);
    unmount();
    act(() => vi.advanceTimersByTime(10000));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('does not advance when disabled', () => {
    const onAdvance = vi.fn();
    renderHook(() => useAutoAdvance({
      enabled: false, duration: 8000, paused: false, page: 0, onAdvance,
    }));
    act(() => vi.advanceTimersByTime(16000));
    expect(onAdvance).not.toHaveBeenCalled();
  });
});
