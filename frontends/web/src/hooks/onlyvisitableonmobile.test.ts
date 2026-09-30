// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as wouter from 'wouter';
import { useOnlyVisitableOnMobile } from './onlyvisitableonmobile';
import * as mediaQueryHooks from '@/hooks/mediaquery';

vi.mock('@/hooks/mediaquery', () => ({
  useMediaQuery: vi.fn(),
}));

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('wouter', async () => {
  const actual = await vi.importActual<typeof import('wouter')>('wouter');

  return {
    ...actual,
    useLocation: () => ['', mockNavigate],
  };
});

describe('useOnlyVisitableOnMobile', () => {
  const useMediaQuerySpy = vi.spyOn(mediaQueryHooks, 'useMediaQuery');
  const useLocationSpy = vi.spyOn(wouter, 'useLocation');
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useLocationSpy.mockReturnValue(['', mockNavigate]);
  });

  it('should not navigate when on mobile device', () => {
    useMediaQuerySpy.mockReturnValue(true);

    renderHook(() => useOnlyVisitableOnMobile('/dashboard'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should navigate to redirect URL when not on mobile device', () => {
    useMediaQuerySpy.mockReturnValue(false);

    renderHook(() => useOnlyVisitableOnMobile('/dashboard'));

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });
});
