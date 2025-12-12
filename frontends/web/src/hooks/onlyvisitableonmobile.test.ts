// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOnlyVisitableOnMobile } from './onlyvisitableonmobile';
import * as mediaQueryHooks from '@/hooks/mediaquery';
import * as reactRouterDom from 'react-router-dom';

vi.mock('@/hooks/mediaquery', () => ({
  useMediaQuery: vi.fn()
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn()
}));

describe('useOnlyVisitableOnMobile', () => {
  const useMediaQuerySpy = vi.spyOn(mediaQueryHooks, 'useMediaQuery');
  const useNavigateSpy = vi.spyOn(reactRouterDom, 'useNavigate');
  const mockNavigate = vi.fn();

  beforeEach(() => {
    useNavigateSpy.mockReturnValue(mockNavigate);
    vi.clearAllMocks();
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