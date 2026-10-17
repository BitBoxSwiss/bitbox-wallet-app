// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readAppearance, saveAppearance } from '@/utils/desktop-appearance';
import { SidebarResize } from './sidebar-resize';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/hooks/darkmode', () => ({ useDarkmode: () => ({ isDarkMode: false }) }));

beforeEach(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.removeAttribute('style');
  localStorage.clear();
});

// Pointer capture keeps a drag working outside the handle, and storage is written only when it ends.
it('drags the edge and persists its bounded width on release', () => {
  render(<nav><SidebarResize /></nav>);
  const handle = screen.getByRole('separator');
  let captured = false;
  Object.assign(handle, {
    setPointerCapture: () => {
      captured = true;
    },
    hasPointerCapture: () => captured,
    releasePointerCapture: () => {
      captured = false;
    },
  });
  fireEvent.pointerDown(handle, { button: 0 });
  fireEvent.pointerMove(handle, { clientX: 340 });
  expect(handle).toHaveAttribute('aria-valuenow', '340');
  expect(document.body.style.getPropertyValue('--design-sidebar-width')).toBe('340px');
  expect(readAppearance().light.sidebarWidth).toBeUndefined();
  fireEvent.pointerMove(handle, { clientX: 900 });
  fireEvent.pointerUp(handle);
  expect(readAppearance().light.sidebarWidth).toBe(600);
  expect(captured).toBe(false);
});

// Keyboard resizing shares the drag limits and preserves unrelated appearance preferences.
it('supports arrow keys and endpoint shortcuts without crossing the width limits', () => {
  saveAppearance('light', { accent: '#123456' });
  render(<SidebarResize />);
  const handle = screen.getByRole('separator');
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  expect(readAppearance().light.sidebarWidth).toBe(250);
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(readAppearance().light.sidebarWidth).toBe(260);
  fireEvent.keyDown(handle, { key: 'End' });
  expect(readAppearance().light.sidebarWidth).toBe(600);
  fireEvent.keyDown(handle, { key: 'Home' });
  expect(readAppearance().light.sidebarWidth).toBe(250);
  expect(readAppearance().light.accent).toBe('#123456');
});
