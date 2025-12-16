// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMountedRef } from './mount';

describe('useMountedRef', () => {
  it('should return true on mount and false on unmount', () => {
    const { result, unmount } = renderHook(() => useMountedRef());
    expect(result.current).toEqual({ current: true });
    unmount();
    expect(result.current).toEqual({ current: false });
  });
});

