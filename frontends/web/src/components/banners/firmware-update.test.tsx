// SPDX-License-Identifier: Apache-2.0

import i18n from '../../../__mocks__/i18n';
import type { ContextType, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VersionInfo } from '@/api/bitbox02';
import type { TDevices } from '@/api/devices';
import { AppContext } from '@/contexts/AppContext';
import { FirmwareUpdateBanner } from './firmware-update';

const bitbox02ApiMocks = vi.hoisted(() => ({
  getVersion: vi.fn(),
}));

vi.mock('@/api/bitbox02', () => bitbox02ApiMocks);

vi.mock('@/hooks/darkmode', () => ({
  useDarkmode: () => ({ isDarkMode: false }),
}));

const updateSessionConfig = vi.fn();

const appContextValue = {
  sessionConfig: {},
  updateSessionConfig,
  setFirmwareUpdateDialogOpen: vi.fn(),
} as unknown as ContextType<typeof AppContext>;

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppContext.Provider value={appContextValue}>
    <MemoryRouter>{children}</MemoryRouter>
  </AppContext.Provider>
);

const versionInfoCommon = {
  currentVersion: '9.21.0',
  canGotoStartupSettings: true,
  canBackupWithRecoveryWords: true,
  canCreate12Words: true,
  canBIP85: true,
  canChangePassword: true,
};
const upgradableVersionInfo: VersionInfo = {
  ...versionInfoCommon,
  canUpgrade: true,
  newVersion: '9.22.0',
};
const upToDateVersionInfo: VersionInfo = {
  ...versionInfoCommon,
  canUpgrade: false,
};

const devices: TDevices = { 'device-id': 'bitbox02' };

describe('components/banners/firmware-update', () => {
  beforeAll(() => {
    i18n.addResourceBundle('en', 'translation', {
      upgradeFirmware: {
        banner: 'BitBox update available. <updateLink>Update now</updateLink> for latest security improvements and features.',
      },
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the banner with a link to the firmware update page', async () => {
    bitbox02ApiMocks.getVersion.mockResolvedValue(upgradableVersionInfo);

    render(<FirmwareUpdateBanner devices={devices} />, { wrapper });

    expect(await screen.findByText('BitBox update available.', { exact: false })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Update now' });
    expect(link).toHaveAttribute('href', '/settings/device-settings/device-id');
  });

  it('dismisses for the current session only', async () => {
    bitbox02ApiMocks.getVersion.mockResolvedValue(upgradableVersionInfo);

    render(<FirmwareUpdateBanner devices={devices} />, { wrapper });

    fireEvent.click(await screen.findByRole('button'));

    expect(screen.queryByText('BitBox update available.', { exact: false })).not.toBeInTheDocument();
    // dismissal is stored in the in-memory session config, not the persisted app config
    expect(updateSessionConfig).toHaveBeenCalledWith({ 'firmware-update-banner': true });
  });

  it('renders nothing if the firmware is up to date', async () => {
    bitbox02ApiMocks.getVersion.mockResolvedValue(upToDateVersionInfo);

    const { container } = render(<FirmwareUpdateBanner devices={devices} />, { wrapper });

    await waitFor(() => expect(bitbox02ApiMocks.getVersion).toHaveBeenCalledOnce());
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing without a connected bitbox02', () => {
    const { container } = render(<FirmwareUpdateBanner devices={{}} />, { wrapper });

    expect(bitbox02ApiMocks.getVersion).not.toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
  });
});
