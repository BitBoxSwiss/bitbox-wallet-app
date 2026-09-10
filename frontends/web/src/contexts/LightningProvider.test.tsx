// SPDX-License-Identifier: Apache-2.0

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as lightningApi from '@/api/lightning';
import { useLightning } from '@/hooks/lightning';
import { AppContext } from './AppContext';
import { LightningProvider } from './LightningProvider';

vi.mock('@/api/lightning', () => ({
  getLightningAccount: vi.fn(),
  getLightningSDKStatus: vi.fn(),
  subscribeLightningAccount: vi.fn(),
  subscribeLightningSDKStatus: vi.fn(),
}));

const LightningState = () => {
  const { isLightningAvailable, lightningAccount, lightningSDKStatus } = useLightning();
  return (
    <div
      data-testid="lightning-state"
      data-account={lightningAccount?.code ?? String(lightningAccount)}
      data-available={String(isLightningAvailable)}
      data-sdk-status={lightningSDKStatus}
    />
  );
};

const renderLightningProvider = (isTesting: boolean | undefined) => render(
  <AppContext.Provider value={{
    activeSidebar: false,
    chartDisplay: 'year',
    firmwareUpdateDialogOpen: false,
    guideExists: false,
    guideShown: false,
    hideAmounts: false,
    isDevServers: false,
    isOnline: true,
    isTesting,
    nativeLocale: 'en',
    sessionConfig: {},
    setActiveSidebar: vi.fn(),
    setChartDisplay: vi.fn(),
    setFirmwareUpdateDialogOpen: vi.fn(),
    setGuideExists: vi.fn(),
    setHideAmounts: vi.fn(),
    setVendorIframeActive: vi.fn(),
    toggleGuide: vi.fn(),
    toggleHideAmounts: vi.fn(),
    toggleSidebar: vi.fn(),
    updateSessionConfig: vi.fn(),
    vendorIframeActive: false,
  }}>
    <LightningProvider>
      <LightningState />
    </LightningProvider>
  </AppContext.Provider>,
);

describe('LightningProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { isTesting: undefined, state: 'testnet status is loading' },
    { isTesting: true, state: 'testnet is active' },
  ])('disables Lightning without loading its state when $state', ({ isTesting }) => {
    renderLightningProvider(isTesting);

    const state = screen.getByTestId('lightning-state');
    expect(state).toHaveAttribute('data-account', 'null');
    expect(state).toHaveAttribute('data-available', 'false');
    expect(state).toHaveAttribute('data-sdk-status', 'inactive');
    expect(lightningApi.getLightningAccount).not.toHaveBeenCalled();
    expect(lightningApi.getLightningSDKStatus).not.toHaveBeenCalled();
  });

  it('enables and loads Lightning after mainnet is confirmed', async () => {
    vi.mocked(lightningApi.getLightningAccount).mockResolvedValue({
      code: 'v0-test-ln-0',
      num: 0,
      rootFingerprint: 'f23ab988',
    });
    vi.mocked(lightningApi.getLightningSDKStatus).mockResolvedValue('ready');

    renderLightningProvider(false);

    const state = screen.getByTestId('lightning-state');
    expect(state).toHaveAttribute('data-available', 'true');
    await waitFor(() => {
      expect(state).toHaveAttribute('data-account', 'v0-test-ln-0');
      expect(state).toHaveAttribute('data-sdk-status', 'ready');
    });
    expect(lightningApi.getLightningAccount).toHaveBeenCalledOnce();
    expect(lightningApi.getLightningSDKStatus).toHaveBeenCalledOnce();
  });
});
