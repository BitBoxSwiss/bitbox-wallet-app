// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/layout', () => ({
  Header: ({ title }: { title: ReactNode }) => <div>{title}</div>,
}));
vi.mock('@/components/spinner/Spinner', () => ({
  Spinner: ({ text }: { text?: string }) => <div>{text}</div>,
}));
vi.mock('@/hooks/backbutton', () => ({
  UseDisableBackButton: () => null,
}));
vi.mock('@/hooks/darkmode', () => ({
  useDarkmode: () => ({ isDarkMode: false, toggleDarkmode: vi.fn() }),
}));
vi.mock('@/hooks/vendor-iframe', () => ({
  useVendorIframeResizeHeight: () => ({
    containerRef: { current: null },
    height: 480,
    iframeLoaded: false,
    onIframeLoad: vi.fn(),
  }),
  useVendorTerms: () => ({
    agreedTerms: true,
    setAgreedTerms: vi.fn(),
  }),
}));
vi.mock('./guide', () => ({
  MarketGuide: () => null,
}));
vi.mock('@/api/market', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/market')>();
  return {
    ...actual,
    getMoonpayBuyInfo: vi.fn(),
  };
});
vi.mock('@/utils/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/config')>();
  return {
    ...actual,
    getConfig: vi.fn(),
  };
});

import { render, screen } from '@testing-library/react';
import type { TAccount } from '@/api/account';
import * as marketApi from '@/api/market';
import * as config from '@/utils/config';
import { Moonpay } from './moonpay';

const account: TAccount = {
  keystore: {
    connected: true,
    lastConnected: '',
    name: 'BitBox02',
    rootFingerprint: 'f23ab988',
    watchonly: false,
  },
  active: true,
  blockExplorerTxPrefix: '',
  code: 'btc-account',
  coinCode: 'btc',
  coinName: 'Bitcoin',
  coinUnit: 'BTC',
  isToken: false,
  name: 'Bitcoin Account',
};

describe('routes/market/moonpay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(config.getConfig).mockResolvedValue({
      frontend: {
        skipMoonpayDisclaimer: true,
      },
    });
  });

  it('renders the MoonPay iframe on success', async () => {
    vi.mocked(marketApi.getMoonpayBuyInfo).mockReturnValue(() => Promise.resolve({
      success: true,
      url: 'https://buy.moonpay.com?walletAddress=bc1qexample',
      address: 'bc1qexample',
    }));

    render(<Moonpay accounts={[account]} code={account.code} />);

    const iframe = await screen.findByTitle('Moonpay');
    expect(iframe).toHaveAttribute(
      'src',
      'https://buy.moonpay.com?walletAddress=bc1qexample&colorCode=%235E94BF&theme=light',
    );
  });

  it('renders an error message on failure', async () => {
    vi.mocked(marketApi.getMoonpayBuyInfo).mockReturnValue(() => Promise.resolve({
      success: false,
      errorMessage: 'Account is not valid.',
    }));

    render(<Moonpay accounts={[account]} code={account.code} />);

    expect(await screen.findByText('Account is not valid.')).toBeInTheDocument();
    expect(screen.queryByTitle('Moonpay')).not.toBeInTheDocument();
  });
});
