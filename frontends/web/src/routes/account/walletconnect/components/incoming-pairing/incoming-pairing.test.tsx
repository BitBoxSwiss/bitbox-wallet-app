// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IWalletKit } from '@reown/walletkit';
import { ProposalTypes, SignClientTypes } from '@walletconnect/types';
import { getSdkError } from '@walletconnect/utils';
import { WCWeb3WalletContext } from '@/contexts/WCWeb3WalletContext';
import { alertUser } from '@/components/alert/Alert';
import { SUPPORTED_CHAINS } from '@/utils/walletconnect';
import { WCIncomingPairing } from './incoming-pairing';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/alert/Alert', () => ({ alertUser: vi.fn() }));

const ADDRESS = '0x1111111111111111111111111111111111111111';
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

const makeProposal = (
  requiredNamespaces: ProposalTypes.RequiredNamespaces,
  optionalNamespaces: ProposalTypes.OptionalNamespaces,
): SignClientTypes.EventArguments['session_proposal'] => {
  const params: ProposalTypes.Struct = {
    id: 1,
    expiryTimestamp: 1,
    optionalNamespaces,
    pairingTopic: 'pairing-topic',
    proposer: {
      metadata: {
        description: 'Test description',
        icons: [],
        name: 'Test dapp',
        url: 'https://example.com',
      },
      publicKey: 'public-key',
    },
    relays: [{ protocol: 'irn' }],
    requiredNamespaces,
  };
  return {
    id: params.id,
    params,
    verifyContext: {
      verified: {
        origin: 'https://example.com',
        validation: 'VALID',
        verifyUrl: 'https://verify.walletconnect.com',
      },
    },
  };
};

const setup = (
  currentProposal: SignClientTypes.EventArguments['session_proposal'],
  approveResult: 'success' | 'failure' = 'success',
  rejectResult: 'success' | 'failure' = 'success',
) => {
  const approveSession = (approveResult === 'success' ?
    vi.fn().mockResolvedValue({}) :
    vi.fn().mockRejectedValue(new Error('Approval failed')));
  const rejectSession = (rejectResult === 'success' ?
    vi.fn().mockResolvedValue(undefined) :
    vi.fn().mockRejectedValue(new Error('Rejection failed')));
  const onApprove = vi.fn();
  const onReject = vi.fn();
  const web3wallet = {
    approveSession,
    rejectSession,
  } as unknown as IWalletKit;

  render(
    <WCWeb3WalletContext.Provider value={{
      initializeWeb3Wallet: vi.fn(),
      isWalletInitialized: true,
      pair: vi.fn(),
      web3wallet,
    }}>
      <WCIncomingPairing
        currentProposal={currentProposal}
        pairingMetadata={currentProposal.params.proposer.metadata}
        receiveAddress={ADDRESS}
        onApprove={onApprove}
        onReject={onReject}
      />
    </WCWeb3WalletContext.Provider>
  );

  return { approveSession, onApprove, onReject, rejectSession };
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  consoleError.mockRestore();
});

describe('WCIncomingPairing', () => {
  it('shows and approves the chains produced from chain-qualified namespaces', async () => {
    const proposal = makeProposal({
      'eip155:10': {
        events: [],
        methods: ['personal_sign'],
      },
    }, {
      'eip155:8453': {
        events: [],
        methods: ['eth_sendTransaction'],
      },
    });
    const { approveSession, onApprove } = setup(proposal);

    expect(screen.getByText('Optimism')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.queryByText('Ethereum mainnet')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {
      name: 'walletConnect.pairingRequest.approve',
    }));

    await waitFor(() => expect(approveSession).toHaveBeenCalledWith({
      id: proposal.id,
      namespaces: {
        eip155: {
          accounts: [
            `eip155:10:${ADDRESS}`,
            `eip155:8453:${ADDRESS}`,
          ],
          chains: ['eip155:10', 'eip155:8453'],
          events: [],
          methods: ['personal_sign', 'eth_sendTransaction'],
        },
      },
    }));
    await waitFor(() => expect(onApprove).toHaveBeenCalledOnce());
  });

  it('shows and approves the specification read-only response for empty namespaces', async () => {
    const proposal = makeProposal({}, {});
    const { approveSession } = setup(proposal);
    const chains = Object.keys(SUPPORTED_CHAINS);

    Object.values(SUPPORTED_CHAINS).forEach(chain => {
      expect(screen.getByText(chain.name)).toBeInTheDocument();
    });
    expect(screen.getByText('walletConnect.pairingRequest.readOnly')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {
      name: 'walletConnect.pairingRequest.approve',
    }));

    await waitFor(() => expect(approveSession).toHaveBeenCalledWith({
      id: proposal.id,
      namespaces: {
        eip155: {
          accounts: chains.map(chain => `${chain}:${ADDRESS}`),
          chains,
          events: [],
          methods: [],
        },
      },
    }));
  });

  it('shows the read-only notice when unsupported optional actions are omitted', () => {
    const proposal = makeProposal({}, {
      eip155: {
        chains: ['eip155:10'],
        events: ['message'],
        methods: ['wallet_sendCalls'],
      },
    });
    setup(proposal);

    expect(screen.getByText('Optimism')).toBeInTheDocument();
    expect(screen.getByText('walletConnect.pairingRequest.readOnly')).toBeInTheDocument();
  });

  it('shows a generic unsupported state and rejects it when closed', async () => {
    const proposal = makeProposal({
      eip155: {
        chains: ['eip155:43114'],
        events: [],
        methods: ['personal_sign'],
      },
    }, {});
    const { approveSession, onReject, rejectSession } = setup(proposal);

    expect(screen.getByText('walletConnect.pairingRequest.unsupported')).toBeInTheDocument();
    expect(screen.queryByText(/eip155:43114/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Non conforming namespaces/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {
      name: 'walletConnect.pairingRequest.approve',
    })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'generic.close' }));

    await waitFor(() => expect(rejectSession).toHaveBeenCalledWith({
      id: proposal.id,
      reason: getSdkError('USER_REJECTED'),
    }));
    expect(approveSession).not.toHaveBeenCalled();
    await waitFor(() => expect(onReject).toHaveBeenCalledOnce());
    expect(alertUser).not.toHaveBeenCalled();
  });

  it('rejects a supported proposal with the generic user rejection reason', async () => {
    const proposal = makeProposal({
      eip155: {
        chains: ['eip155:1'],
        events: [],
        methods: ['personal_sign'],
      },
    }, {});
    const { approveSession, onReject, rejectSession } = setup(proposal);

    fireEvent.click(screen.getByRole('button', {
      name: 'walletConnect.pairingRequest.reject',
    }));

    await waitFor(() => expect(rejectSession).toHaveBeenCalledWith({
      id: proposal.id,
      reason: getSdkError('USER_REJECTED'),
    }));
    expect(approveSession).not.toHaveBeenCalled();
    await waitFor(() => expect(onReject).toHaveBeenCalledOnce());
  });

  it('closes locally and reports an error when rejection fails', async () => {
    const proposal = makeProposal({
      eip155: {
        chains: ['eip155:43114'],
        events: [],
        methods: ['personal_sign'],
      },
    }, {});
    const { approveSession, onReject, rejectSession } = setup(
      proposal,
      'success',
      'failure',
    );
    const closeButton = screen.getByRole('button', { name: 'generic.close' });

    fireEvent.click(closeButton);

    await waitFor(() => expect(alertUser).toHaveBeenCalledWith(
      'walletConnect.pairingRequest.rejectionFailed',
    ));
    expect(rejectSession).toHaveBeenCalledWith({
      id: proposal.id,
      reason: getSdkError('USER_REJECTED'),
    });
    expect(approveSession).not.toHaveBeenCalled();
    await waitFor(() => expect(onReject).toHaveBeenCalledOnce());
    await waitFor(() => expect(closeButton).not.toBeDisabled());
  });

  it('alerts and rejects after an unexpected approval failure', async () => {
    const proposal = makeProposal({
      eip155: {
        chains: ['eip155:1'],
        events: [],
        methods: ['personal_sign'],
      },
    }, {});
    const { onReject, rejectSession } = setup(proposal, 'failure');

    fireEvent.click(screen.getByRole('button', {
      name: 'walletConnect.pairingRequest.approve',
    }));

    await waitFor(() => expect(alertUser).toHaveBeenCalledWith('Approval failed'));
    expect(rejectSession).toHaveBeenCalledWith({
      id: proposal.id,
      reason: getSdkError('USER_REJECTED'),
    });
    await waitFor(() => expect(onReject).toHaveBeenCalledOnce());
  });
});
