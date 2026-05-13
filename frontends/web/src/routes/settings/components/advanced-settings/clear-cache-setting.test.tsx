// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, beforeEach, Mock, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClearCacheSetting } from './clear-cache-setting';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'button.back': 'Back',
      'genericError': 'An error occurred. If you notice any issues, please restart the application.',
      'settings.expert.clearCache.description': 'Clear the cache of the BitBoxApp. This can help fix issues in the app.',
      'settings.expert.clearCache.dialog.description': 'Clear the cache of the BitBoxApp. If you are experiencing issues with the BitBoxApp, this can help resolve them.',
      'settings.expert.clearCache.dialog.note': 'Your account names, notes and wallets are not affected.',
      'settings.expert.clearCache.dialog.primaryCTA': 'Clear Cache',
      'settings.expert.clearCache.dialog.title': 'Clear cache',
      'settings.expert.clearCache.title': 'Clear cache',
    }[key] ?? key),
  }),
}));

vi.mock('@/api/backend', () => ({
  clearCache: vi.fn(),
}));

vi.mock('@/hooks/mediaquery', () => ({
  useMediaQuery: vi.fn().mockReturnValue(false),
}));

import { clearCache } from '@/api/backend';

describe('routes/settings/components/advanced-settings/clear-cache-setting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (clearCache as Mock).mockResolvedValue({ success: true });
  });

  it('opens the dialog and clears the cache', async () => {
    const user = userEvent.setup();

    render(<ClearCacheSetting />);

    await user.click(screen.getByRole('button', { name: /Clear cache/i }));

    expect(screen.getByRole('heading', { name: 'Clear cache' })).toBeInTheDocument();
    expect(screen.getByText('Clear the cache of the BitBoxApp. If you are experiencing issues with the BitBoxApp, this can help resolve them.')).toBeInTheDocument();
    expect(screen.getByText('Your account names, notes and wallets are not affected.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear Cache' }));

    await waitFor(() => {
      expect(clearCache).toHaveBeenCalledTimes(1);
    });
  });
});
