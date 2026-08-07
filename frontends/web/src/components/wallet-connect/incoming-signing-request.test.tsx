// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WCWeb3WalletContext } from '@/contexts/WCWeb3WalletContext';
import { rejectMessage } from '@/utils/walletconnect';

const mocks = vi.hoisted(() => ({
  handleWcEthSignRequest: vi.fn(),
}));

vi.mock('@/utils/walletconnect-eth-sign-handlers', () => ({
  handleWcEthSignRequest: mocks.handleWcEthSignRequest,
}));

vi.mock('./incoming-signing-request-dialog', () => ({
  WCIncomingSignRequestDialog: ({ onAccept }: { onAccept: () => void }) => (
    <button onClick={onAccept}>Accept request</button>
  ),
}));

vi.mock('@/components/dialog/firmware-upgrade-required-dialog', () => ({
  FirmwareUpgradeRequiredDialog: ({ open }: { open: boolean }) => open
    ? <div>Firmware upgrade required</div>
    : null,
}));

import { WCSigningRequest } from './incoming-signing-request';

describe('components/wallet-connect/incoming-signing-request', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.handleWcEthSignRequest.mockImplementation(async (_method, args) => {
      args.launchSignDialog({
        topic: args.topic,
        id: args.id,
        apiCaller: async () => ({
          success: false,
          error: { errorCode: 'firmwareUpgradeRequired' },
        }),
        dialogContent: {
          accountName: 'Ethereum Account',
          accountAddress: '0x1234',
          signingData: 'hello',
          currentSession: args.currentSession,
          method: 'Sign message',
          chain: 'eip155:1',
        },
      });
    });
  });

  it('rejects the request and prompts for a firmware upgrade', async () => {
    let sessionRequestHandler: ((event: unknown) => Promise<void>) | undefined;
    const currentSession = { topic: 'session-topic' };
    const web3wallet = {
      getActiveSessions: vi.fn(() => ({ session: currentSession })),
      on: vi.fn((_event, handler) => {
        sessionRequestHandler = handler;
      }),
      off: vi.fn(),
      respondSessionRequest: vi.fn(),
    };

    render(
      <WCWeb3WalletContext.Provider value={{
        isWalletInitialized: true,
        web3wallet: web3wallet as never,
        pair: vi.fn(),
        initializeWeb3Wallet: vi.fn(),
      }}>
        <WCSigningRequest />
      </WCWeb3WalletContext.Provider>
    );

    await waitFor(() => expect(sessionRequestHandler).toBeDefined());
    await act(async () => {
      await sessionRequestHandler?.({
        topic: 'session-topic',
        id: 42,
        params: {
          request: { method: 'personal_sign', params: [] },
        },
      });
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Accept request' }));

    expect(await screen.findByText('Firmware upgrade required')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept request' })).not.toBeInTheDocument();
    expect(web3wallet.respondSessionRequest).toHaveBeenCalledWith({
      topic: 'session-topic',
      response: rejectMessage(42),
    });
  });
});
