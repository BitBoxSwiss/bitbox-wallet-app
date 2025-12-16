// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderHook } from '@testing-library/react';
import { act } from 'react';
import { useEsc } from './keyboard';

describe('useEsc', () => {
  it('should fire its callback when escape key gets pressed', () => {
    const mock = vi.fn();
    renderHook((() => useEsc(mock)));
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape', code: 27 });
    });
    expect(mock).toHaveBeenCalled();
  });
});
