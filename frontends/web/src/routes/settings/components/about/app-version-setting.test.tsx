// SPDX-License-Identifier: Apache-2.0

import '../../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TUpdateFile, TUpdateState } from '@/api/version';
import { AppVersion } from './app-version-setting';

const versionApiMocks = vi.hoisted(() => ({
  getUpdate: vi.fn(),
  getVersion: vi.fn(),
  subscribeUpdate: vi.fn(),
}));

vi.mock('@/api/version', () => versionApiMocks);

vi.mock('@/routes/settings/components/settingsItem/settingsItem', () => ({
  SettingsItem: ({
    displayedValue,
    secondaryText,
  }: {
    displayedValue: ReactNode;
    secondaryText: string;
  }) => (
    <div>
      <span>{secondaryText}</span>
      <span>{displayedValue}</span>
    </div>
  ),
}));

vi.mock('@/routes/settings/bb02-settings', () => ({
  StyledSkeleton: () => <div>loading</div>,
}));

vi.mock('@/components/appdownloadlink/appdownloadlink', () => ({
  downloadLinkByLanguage: () => 'https://bitbox.swiss/download/',
}));

const update: TUpdateFile = {
  current: '4.51.3',
  version: '4.52.0',
  description: 'A new version is ready.',
};
const noUpdateState: TUpdateState = { revision: 0, update: null };
const updateState: TUpdateState = { revision: 1, update };

describe('routes/settings/components/about/app-version-setting', () => {
  let notifyUpdate: ((state: TUpdateState) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    notifyUpdate = undefined;
    versionApiMocks.getVersion.mockResolvedValue('4.51.3');
    versionApiMocks.getUpdate.mockResolvedValue(noUpdateState);
    versionApiMocks.subscribeUpdate.mockImplementation((cb: typeof notifyUpdate) => {
      notifyUpdate = cb;
      return () => {};
    });
  });

  it('renders a cached update', async () => {
    versionApiMocks.getUpdate.mockResolvedValue(updateState);

    render(<AppVersion />);

    expect(await screen.findByText('settings.info.out-of-date')).toBeInTheDocument();
    expect(await screen.findByText('4.51.3')).toBeInTheDocument();
    expect(versionApiMocks.subscribeUpdate).toHaveBeenCalledOnce();
  });

  it('reacts to an update received from the subscription', async () => {
    render(<AppVersion />);

    expect(await screen.findByText('settings.info.up-to-date')).toBeInTheDocument();
    await waitFor(() => expect(versionApiMocks.subscribeUpdate).toHaveBeenCalledOnce());

    act(() => notifyUpdate?.(updateState));

    expect(screen.getByText('settings.info.out-of-date')).toBeInTheDocument();
  });
});
