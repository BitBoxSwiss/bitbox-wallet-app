// SPDX-License-Identifier: Apache-2.0

import { StrictMode, useContext, useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { IWalletKit } from '@reown/walletkit';
import { WCWeb3WalletContext } from './WCWeb3WalletContext';
import { WCWeb3WalletProvider } from './WCWeb3WalletProvider';

const init = vi.hoisted(() => vi.fn());
vi.mock('@walletconnect/core', () => ({ Core: class {} }));
vi.mock('@reown/walletkit', () => ({ WalletKit: { init } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./ConfigProvider', () => ({
  useConfig: () => ({ config: { frontend: { hasUsedWalletConnect: true } }, setConfig: vi.fn() }),
}));

const Consumer = () => {
  const { initializeWeb3Wallet, isWalletInitialized } = useContext(WCWeb3WalletContext);
  useEffect(() => {
    initializeWeb3Wallet();
  }, [initializeWeb3Wallet]);
  return <button onClick={initializeWeb3Wallet}>{isWalletInitialized ? 'Ready' : 'Initialize'}</button>;
};

beforeEach(() => {
  init.mockReset();
});

it('initializes one wallet across concurrent callers and subsequent renders', async () => {
  let resolve!: (wallet: IWalletKit) => void;
  init.mockImplementation(() => new Promise<IWalletKit>(done => {
    resolve = done;
  }));
  const app = <StrictMode><WCWeb3WalletProvider><Consumer /></WCWeb3WalletProvider></StrictMode>;
  const { rerender } = render(app);
  await waitFor(() => expect(init).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('button', { name: 'Initialize' }));
  rerender(app);
  await act(async () => {
    resolve({} as IWalletKit);
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Ready' }));
  expect(init).toHaveBeenCalledOnce();
});

it('allows retry after initialization fails', async () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  try {
    init.mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValue({});
    render(<WCWeb3WalletProvider><Consumer /></WCWeb3WalletProvider>);
    await waitFor(() => expect(log).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Initialize' }));
    expect(await screen.findByRole('button', { name: 'Ready' })).toBeInTheDocument();
    expect(init).toHaveBeenCalledTimes(2);
  } finally {
    log.mockRestore();
  }
});
