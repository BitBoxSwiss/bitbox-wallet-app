// SPDX-License-Identifier: Apache-2.0

import { Profiler } from 'react';
import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { getQtChannel } from '@/utils/transport-qt';
import { initializeDesktopChrome } from '@/utils/desktop-chrome';
import { Header } from './header';
import { Main } from './main';

vi.mock('@/utils/transport-qt', () => ({ getQtChannel: vi.fn() }));
vi.mock('@/utils/env', () => ({ runningInQtWebEngine: () => true }));
vi.mock('./header', () => ({ Header: () => <div>Caption</div> }));

// Resizing and focusing the native window must not rerender page layout; a CSD capability change must.
it('only rerenders the layout when its desktop capability changes', async () => {
  let changed!: () => void;
  const state = { csd: true, document: 1, viewport: 1, topInset: 0, leftInset: 0, rightInset: 52, cornerRadius: 12 };
  vi.mocked(getQtChannel).mockResolvedValue({ objects: { desktopChrome: {
    state,
    stateChanged: { connect: (callback: () => void) => {
      changed = callback;
    } },
  } } });
  await initializeDesktopChrome();
  const renders = vi.fn();
  render(<Profiler id="layout" onRender={renders}><Main><Header /><p>Content</p></Main></Profiler>);
  expect(screen.getByRole('main')).not.toContainElement(screen.getByText('Caption'));
  renders.mockClear();
  for (let viewport = 2; viewport <= 4; ++viewport) {
    act(() => {
      state.viewport = viewport;
      changed();
    });
  }
  expect(renders).not.toHaveBeenCalled();
  act(() => {
    state.csd = false;
    changed();
  });
  expect(renders).toHaveBeenCalledOnce();
  expect(screen.getByRole('main')).toContainElement(screen.getByText('Caption'));
});
