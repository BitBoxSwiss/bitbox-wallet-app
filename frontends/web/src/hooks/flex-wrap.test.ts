// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlexWrap } from './flex-wrap';

let resizeCallback: (() => void) | null = null;
const disconnectMock = vi.fn();

beforeEach(() => {
  resizeCallback = null;
  disconnectMock.mockClear();
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: () => void) {
      resizeCallback = cb;
    }
    observe() {}
    disconnect() {
      disconnectMock();
    }
  });
});

const createParentWithChildren = (firstChildTop: number, targetTop: number) => {
  const parent = document.createElement('div');
  const first = document.createElement('div');
  const target = document.createElement('div');

  Object.defineProperty(first, 'offsetTop', { get: () => firstChildTop, configurable: true });
  Object.defineProperty(target, 'offsetTop', { get: () => targetTop, configurable: true });

  parent.appendChild(first);
  parent.appendChild(target);

  return { parent, target };
};

describe('useFlexWrap', () => {
  it('returns isWrapped false when element is on the same line', () => {
    const { target } = createParentWithChildren(0, 0);
    const { result } = renderHook(() => {
      const hook = useFlexWrap<HTMLDivElement>();
      (hook.ref as React.MutableRefObject<HTMLDivElement>).current = target as unknown as HTMLDivElement;
      return hook;
    });
    expect(result.current.isWrapped).toBe(false);
  });

  it('returns isWrapped true when element has wrapped', () => {
    const { target } = createParentWithChildren(0, 50);
    const { result } = renderHook(() => {
      const hook = useFlexWrap<HTMLDivElement>();
      (hook.ref as React.MutableRefObject<HTMLDivElement>).current = target as unknown as HTMLDivElement;
      return hook;
    });
    expect(result.current.isWrapped).toBe(true);
  });

  it('updates isWrapped when parent resizes and element wraps', () => {
    const { target } = createParentWithChildren(0, 0);
    const { result } = renderHook(() => {
      const hook = useFlexWrap<HTMLDivElement>();
      (hook.ref as React.MutableRefObject<HTMLDivElement>).current = target as unknown as HTMLDivElement;
      return hook;
    });
    expect(result.current.isWrapped).toBe(false);

    Object.defineProperty(target, 'offsetTop', { get: () => 50, configurable: true });
    act(() => resizeCallback?.());
    expect(result.current.isWrapped).toBe(true);
  });

  it('updates isWrapped back to false when element unwraps', () => {
    const { target } = createParentWithChildren(0, 50);
    const { result } = renderHook(() => {
      const hook = useFlexWrap<HTMLDivElement>();
      (hook.ref as React.MutableRefObject<HTMLDivElement>).current = target as unknown as HTMLDivElement;
      return hook;
    });
    //wraps
    expect(result.current.isWrapped).toBe(true);

    //unwraps
    Object.defineProperty(target, 'offsetTop', { get: () => 0, configurable: true });
    act(() => resizeCallback?.());
    expect(result.current.isWrapped).toBe(false);
  });

  it('disconnects ResizeObserver on unmount', () => {
    const { target } = createParentWithChildren(0, 0);
    const { unmount } = renderHook(() => {
      const hook = useFlexWrap<HTMLDivElement>();
      (hook.ref as React.MutableRefObject<HTMLDivElement>).current = target as unknown as HTMLDivElement;
      return hook;
    });
    unmount();
    expect(disconnectMock).toHaveBeenCalled();
  });
});
