// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GlobalBannersContainerContext } from '@/contexts/global-banners-context';
import { Main } from './main';

describe('Main', () => {
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
