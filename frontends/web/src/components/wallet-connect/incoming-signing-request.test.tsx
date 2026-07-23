// SPDX-License-Identifier: Apache-2.0

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IWalletKit } from '@reown/walletkit';
import type { SignClientTypes } from '@walletconnect/types';
import type { TAccount } from '@/api/account';
import { WCWeb3WalletContext } from '@/contexts/WCWeb3WalletContext';
import type {
  TEthSignHandlerParams,
  TLaunchSignDialog,
  TSignDialogResult,
} from '@/utils/walletconnect-eth-sign-handlers';
import { WCSigningRequest } from './incoming-signing-request';

const handlers = vi.hoisted(() => ({
  createSessionRequestResponder: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
  handleWcEthSignRequest: vi.fn(),
}));
const alertUser = vi.hoisted(() => vi.fn());
const backButton = vi.hoisted(() => ({ handler: undefined as (() => boolean) | undefined }));
const connectKeystore = vi.hoisted(() => vi.fn());

vi.mock('@/utils/walletconnect-eth-sign-handlers', () => handlers);
vi.mock('@/components/alert/Alert', () => ({ alertUser }));
vi.mock('@/api/keystores', () => ({ connectKeystore }));
vi.mock('i18next', () => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/hooks/darkmode', () => ({ useDarkmode: () => ({ isDarkMode: false }) }));
vi.mock('@/hooks/mediaquery', () => ({ useMediaQuery: () => false }));
vi.mock('@/hooks/backbutton', () => ({
  UseBackButton: ({ handler }: { handler: () => boolean }) => {
    backButton.handler = handler;
    return null;
  },
}));

const account = {
  code: 'eth-account',
  keystore: { rootFingerprint: 'aabbccdd' },
} as TAccount;

const dialogContent = (signingData = 'first request'): TLaunchSignDialog['dialogContent'] => ({
  accountAddress: '0x1111111111111111111111111111111111111111',
  accountName: 'Ethereum account',
  chain: 'eip155:1',
  currentSession: {
    peer: { metadata: { description: '', icons: [], name: 'Test dapp', url: 'https://example.com' } },
  } as unknown as TLaunchSignDialog['dialogContent']['currentSession'],
  method: 'Sign message',
  signingData,
});

const makeRequest = (overrides: Partial<TLaunchSignDialog> = {}): TLaunchSignDialog => ({
  accountCode: account.code,
  apiCaller: vi.fn().mockResolvedValue({ success: true }),
  dialogContent: dialogContent(),
  onReject: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const setup = (requests: TLaunchSignDialog[]) => {
  let listener: ((event: SignClientTypes.EventArguments['session_request']) => Promise<void>) | undefined;
  let requestIndex = 0;
  const launchResults: boolean[] = [];
  handlers.handleWcEthSignRequest.mockImplementation(async ({ launchSignDialog }: TEthSignHandlerParams) => {
    launchResults.push(launchSignDialog(requests[requestIndex++]!));
  });
  const web3wallet = {
    getActiveSessions: vi.fn(() => ({})),
    off: vi.fn(),
    on: vi.fn((event: string, callback: typeof listener) => {
      if (event === 'session_request') {
        listener = callback;
      }
    }),
    respondSessionRequest: vi.fn(),
  } as unknown as IWalletKit;

  render(
    <WCWeb3WalletContext.Provider value={{
      initializeWeb3Wallet: vi.fn(),
      isWalletInitialized: true,
      pair: vi.fn(),
      web3wallet,
    }}>
      <WCSigningRequest accounts={[account]} />
    </WCWeb3WalletContext.Provider>
  );

  const emitRequest = async (id = 1) => {
    await act(async () => listener?.({ id, params: {}, topic: `topic-${id}` } as
      SignClientTypes.EventArguments['session_request']));
  };
  return { emitRequest, launchResults };
};

beforeEach(() => {
  vi.clearAllMocks();
  connectKeystore.mockResolvedValue({ success: true });
  backButton.handler = undefined;
});

describe('WCSigningRequest', () => {
  it('rejects and closes the active request', async () => {
    const request = makeRequest();
    const { emitRequest } = setup([request]);
    await emitRequest();

    fireEvent.click(await screen.findByRole('button', { name: 'dialog.cancel' }));

    await waitFor(() => expect(request.onReject).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: 'button.continue' })).not.toBeInTheDocument();
  });

  it('shows acceptance after successful signing', async () => {
    const apiCaller = vi.fn().mockResolvedValue({ success: true } as const);
    const request = makeRequest({ apiCaller });
    const { emitRequest } = setup([request]);
    await emitRequest();

    fireEvent.click(await screen.findByRole('button', { name: 'button.continue' }));

    await waitFor(() => expect(request.apiCaller).toHaveBeenCalledOnce());
    expect(connectKeystore).toHaveBeenCalledWith(account.keystore.rootFingerprint);
    expect(connectKeystore.mock.invocationCallOrder[0]).toBeLessThan(apiCaller.mock.invocationCallOrder[0]!);
    expect(await screen.findByText('walletConnect.signingRequest.successfullySigned')).toBeInTheDocument();
  });

  it('rejects without signing when connecting the keystore fails', async () => {
    connectKeystore.mockResolvedValueOnce({ success: false });
    const request = makeRequest();
    const { emitRequest } = setup([request]);
    await emitRequest();

    fireEvent.click(await screen.findByRole('button', { name: 'button.continue' }));

    await waitFor(() => expect(request.onReject).toHaveBeenCalledOnce());
    expect(request.apiCaller).not.toHaveBeenCalled();
    expect(screen.queryByText('confirmOnDevice')).not.toBeInTheDocument();
  });

  it('closes and alerts after failed signing', async () => {
    const request = makeRequest({
      apiCaller: vi.fn().mockResolvedValue({ success: false, errorMessage: 'Backend failed' }),
    });
    const { emitRequest } = setup([request]);
    await emitRequest();

    fireEvent.click(await screen.findByRole('button', { name: 'button.continue' }));

    await waitFor(() => expect(alertUser).toHaveBeenCalledWith('Backend failed'));
    expect(screen.queryByRole('button', { name: 'button.continue' })).not.toBeInTheDocument();
  });

  it('does not replace an active request', async () => {
    const first = makeRequest();
    const second = makeRequest({ dialogContent: dialogContent('second request') });
    const { emitRequest, launchResults } = setup([first, second]);

    await emitRequest(1);
    await emitRequest(2);

    expect(launchResults).toEqual([true, false]);
    expect(screen.getByDisplayValue('first request')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('second request')).not.toBeInTheDocument();
  });

  it('cannot be closed while signing is in progress', async () => {
    const request = makeRequest({
      apiCaller: vi.fn(() => new Promise<TSignDialogResult>(() => {})),
    });
    const { emitRequest } = setup([request]);
    await emitRequest();

    fireEvent.click(await screen.findByRole('button', { name: 'button.continue' }));
    await screen.findByText('confirmOnDevice');
    expect(screen.queryByRole('button', { name: 'dialog.cancel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'button.continue' })).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await act(async () => backButton.handler?.());

    expect(screen.getByText('confirmOnDevice')).toBeInTheDocument();
    expect(request.onReject).not.toHaveBeenCalled();
  });
});
