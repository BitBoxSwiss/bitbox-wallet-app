// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { runningInAndroid } from '@/utils/env';
import { useAndroidKeyboardVisible } from './use-android-keyboard-visible';

vi.mock('@/utils/env', () => ({
  runningInAndroid: vi.fn(),
}));

const runningInAndroidMock = vi.mocked(runningInAndroid);

describe('useAndroidKeyboardVisible', () => {
  beforeEach(() => {
    runningInAndroidMock.mockReturnValue(true);
    window.android = { call: vi.fn() };
    window.androidKeyboardVisible = false;
  });

  afterEach(() => {
    delete window.android;
    delete window.androidKeyboardVisible;
    delete window.onKeyboardVisibilityChanged;
    vi.clearAllMocks();
  });

  it('uses the native Android keyboard signal', () => {
    const { result } = renderHook(() => useAndroidKeyboardVisible());

    expect(result.current).toBe(false);

    act(() => {
      window.onKeyboardVisibilityChanged?.(true);
    });

    expect(result.current).toBe(true);
  });

  it('uses the initial native Android keyboard visibility', () => {
    window.androidKeyboardVisible = true;

    const { result } = renderHook(() => useAndroidKeyboardVisible());

    expect(result.current).toBe(true);
  });

  it('does not report keyboard visibility outside Android', () => {
    runningInAndroidMock.mockReturnValue(false);
    window.androidKeyboardVisible = true;

    const { result } = renderHook(() => useAndroidKeyboardVisible());

    expect(result.current).toBe(false);
  });
});
