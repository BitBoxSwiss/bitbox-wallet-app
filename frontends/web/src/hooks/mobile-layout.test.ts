// SPDX-License-Identifier: Apache-2.0

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_LAYOUT_QUERY, useMobileLayout } from './mobile-layout';

type TMatchMediaController = {
  setMatches: (matches: boolean) => void;
};

const mockMatchMedia = (initialMatches: boolean): TMatchMediaController => {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    onchange: null,
    addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches, media: MOBILE_LAYOUT_QUERY } as MediaQueryListEvent;
      listeners.forEach(listener => listener(event));
    },
  };
};

describe('useMobileLayout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each<[string, boolean]>([
    ['a narrow portrait phone', true],
    ['a short coarse-pointer landscape phone', true],
    ['a tablet landscape viewport', false],
    ['a short fine-pointer desktop viewport', false],
  ])('returns the media-query result for %s', (_description, matches) => {
    mockMatchMedia(matches);

    const { result } = renderHook(() => useMobileLayout());

    expect(result.current).toBe(matches);
    expect(window.matchMedia).toHaveBeenCalledWith(MOBILE_LAYOUT_QUERY);
  });

  it('updates when rotation changes the media-query result', () => {
    const controller = mockMatchMedia(false);
    const { result } = renderHook(() => useMobileLayout());

    act(() => controller.setMatches(true));

    expect(result.current).toBe(true);
  });
});
