// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlobalBannersContainerContext } from '@/contexts/global-banners-context';
import { useDesktopModernized } from '@/components/desktop-chrome/desktop-chrome';
import { Header } from './header';
import { Main } from './main';

vi.mock('@/components/desktop-chrome/desktop-chrome', () => ({ useDesktopModernized: vi.fn() }));
vi.mock('./header', () => ({ Header: () => <div data-window-header>Caption</div> }));
afterEach(() => vi.mocked(useDesktopModernized).mockReset());

describe('Main', () => {
  // Late desktop capability discovery moves the caption while preserving the banner container.
  it('keeps the desktop caption outside scrolling content and restores banners when the capability arrives', () => {
    const element = document.createElement('div');
    element.textContent = 'Banner';
    const fallback = document.createElement('div');
    const globalBannersContainer = { element, restore: vi.fn(() => fallback.append(element)) };
    const page = (
      <GlobalBannersContainerContext.Provider value={globalBannersContainer}>
        <Main><Header /><p>Scrollable content</p></Main>
      </GlobalBannersContainerContext.Provider>
    );
    const { rerender } = render(page);
    expect(screen.getByRole('main')).toContainElement(screen.getByText('Caption'));
    vi.mocked(useDesktopModernized).mockReturnValue(true);
    rerender(
      <GlobalBannersContainerContext.Provider value={globalBannersContainer}>
        <Main><Header /><p>Scrollable content</p></Main>
      </GlobalBannersContainerContext.Provider>
    );
    expect(screen.getByRole('main')).not.toContainElement(screen.getByText('Caption'));
    expect(screen.getByRole('main')).toContainElement(screen.getByText('Banner'));
    expect(screen.getByRole('main')).toContainElement(screen.getByText('Scrollable content'));
    expect(globalBannersContainer.restore).toHaveBeenCalledOnce();
  });

  it('moves the persistent global banners into the active scroll container', () => {
    const fallbackContainer = document.createElement('div');
    const bannersContainer = document.createElement('div');
    const banner = document.createElement('div');
    bannersContainer.appendChild(banner);
    fallbackContainer.appendChild(bannersContainer);
    const globalBannersContainer = {
      element: bannersContainer,
      restore: vi.fn(() => fallbackContainer.appendChild(bannersContainer)),
    };

    const { container, rerender } = render(
      <GlobalBannersContainerContext.Provider value={globalBannersContainer}>
        <Main key="first">First page</Main>
      </GlobalBannersContainerContext.Provider>,
    );

    expect(container.querySelector('main')?.firstChild).toBe(bannersContainer);

    rerender(
      <GlobalBannersContainerContext.Provider value={globalBannersContainer}>
        <div>Page without a scroll container</div>
      </GlobalBannersContainerContext.Provider>,
    );

    expect(globalBannersContainer.restore).toHaveBeenCalledOnce();
    expect(fallbackContainer.firstChild).toBe(bannersContainer);

    rerender(
      <GlobalBannersContainerContext.Provider value={globalBannersContainer}>
        <Main key="second">Second page</Main>
      </GlobalBannersContainerContext.Provider>,
    );

    expect(container.querySelector('main')?.firstChild).toBe(bannersContainer);
    expect(bannersContainer.firstChild).toBe(banner);
  });
});
