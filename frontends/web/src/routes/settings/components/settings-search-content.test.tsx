// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useLocation } from '@/utils/router-compatability';
import { MemoryRouter } from '@/utils/test-helpers';
import type { TSettingsSearchItem } from '../settings-search';
import { SettingsSearchContent } from './settings-search-content';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const LocationPath = () => {
  const location = useLocation();
  return <span data-testid="location-path">{location.pathname}{location.search}</span>;
};

describe('settings search navigation', () => {
  // Contacts open their own screen; ordinary results retain their settings-page highlight.
  it.each([
    {
      searchResult: {
        id: 'lightning-contacts',
        page: 'advanced',
        title: 'Contacts',
        url: '/lightning/contacts',
      },
      destination: '/lightning/contacts',
    },
    {
      searchResult: {
        id: 'lightning-settings',
        page: 'advanced',
        title: 'Lightning settings',
      },
      destination: '/settings/advanced-settings?settingsHighlight=lightning-settings',
    },
  ] satisfies { searchResult: TSettingsSearchItem; destination: string }[])(
    'opens $destination when selecting $searchResult.title',
    async ({ searchResult, destination }) => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/settings']}>
          <SettingsSearchContent devices={{}} searchResults={[searchResult]} />
          <LocationPath />
        </MemoryRouter>
      );

      await user.click(screen.getByRole('button', { name: searchResult.title }));

      expect(screen.getByTestId('location-path')).toHaveTextContent(destination);
    }
  );
});
