// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { ProposalTypes } from '@walletconnect/types';
import {
  EIP155_SIGNING_METHODS,
  SUPPORTED_CHAINS,
} from './walletconnect';
import { prepareSessionProposal } from './walletconnect-session-proposal';

const ADDRESS = '0x1111111111111111111111111111111111111111';

const makeProposal = (
  requiredNamespaces: ProposalTypes.RequiredNamespaces,
  optionalNamespaces: ProposalTypes.OptionalNamespaces,
): ProposalTypes.Struct => ({
  id: 1,
  expiryTimestamp: 1,
  optionalNamespaces,
  pairingTopic: 'pairing-topic',
  proposer: {
    metadata: {
      description: 'Test dapp',
      icons: [],
      name: 'Test dapp',
      url: 'https://example.com',
    },
    publicKey: 'public-key',
  },
  relays: [{ protocol: 'irn' }],
  requiredNamespaces,
});

const getReadyResult = (
  requiredNamespaces: ProposalTypes.RequiredNamespaces,
  optionalNamespaces: ProposalTypes.OptionalNamespaces,
) => {
  const result = prepareSessionProposal(
    makeProposal(requiredNamespaces, optionalNamespaces),
    ADDRESS,
  );
  expect(result.status).toBe('ready');
  if (result.status !== 'ready') {
    throw new Error('Expected a supported session proposal');
  }
  return result;
};

describe('prepareSessionProposal', () => {
  it('approves a required-only proposal', () => {
    const result = getReadyResult({
      eip155: {
        chains: ['eip155:1'],
        events: ['accountsChanged'],
        methods: [EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V3],
      },
    }, {});

    expect(result.namespaces).toEqual({
      eip155: {
        accounts: [`eip155:1:${ADDRESS}`],
        chains: ['eip155:1'],
        events: ['accountsChanged'],
        methods: [EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V3],
      },
    });
  });

  it('approves an optional-only proposal', () => {
    const result = getReadyResult({}, {
      eip155: {
        chains: ['eip155:10'],
        events: ['chainChanged'],
        methods: [EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION],
      },
    });

    expect(result.namespaces).toEqual({
      eip155: {
        accounts: [`eip155:10:${ADDRESS}`],
        chains: ['eip155:10'],
        events: ['chainChanged'],
        methods: [EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION],
      },
    });
  });

  it('combines supported required and optional capabilities', () => {
    const result = getReadyResult({
      eip155: {
        chains: ['eip155:1'],
        events: [],
        methods: [EIP155_SIGNING_METHODS.PERSONAL_SIGN],
      },
    }, {
      eip155: {
        chains: ['eip155:10', 'eip155:43114'],
        events: ['chainChanged', 'message'],
        methods: [EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION, 'wallet_sendCalls'],
      },
    });

    expect(result.namespaces).toEqual({
      eip155: {
        accounts: [
          `eip155:1:${ADDRESS}`,
          `eip155:10:${ADDRESS}`,
        ],
        chains: ['eip155:1', 'eip155:10'],
        events: ['chainChanged'],
        methods: [
          EIP155_SIGNING_METHODS.PERSONAL_SIGN,
          EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION,
        ],
      },
    });
  });

  it('normalizes chain-qualified namespace keys', () => {
    const result = getReadyResult({
      'eip155:10': {
        events: ['accountsChanged'],
        methods: [EIP155_SIGNING_METHODS.PERSONAL_SIGN],
      },
    }, {
      'eip155:8453': {
        events: ['chainChanged'],
        methods: [EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION],
      },
    });

    expect(result.namespaces).toEqual({
      eip155: {
        accounts: [
          `eip155:10:${ADDRESS}`,
          `eip155:8453:${ADDRESS}`,
        ],
        chains: ['eip155:10', 'eip155:8453'],
        events: ['accountsChanged', 'chainChanged'],
        methods: [
          EIP155_SIGNING_METHODS.PERSONAL_SIGN,
          EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION,
        ],
      },
    });
  });

  it.each([
    {
      kind: 'chain',
      namespace: {
        chains: ['eip155:43114'],
        events: [],
        methods: [EIP155_SIGNING_METHODS.PERSONAL_SIGN],
      },
    },
    {
      kind: 'method',
      namespace: {
        chains: ['eip155:1'],
        events: [],
        methods: ['wallet_sendCalls'],
      },
    },
    {
      kind: 'event',
      namespace: {
        chains: ['eip155:1'],
        events: ['message'],
        methods: [EIP155_SIGNING_METHODS.PERSONAL_SIGN],
      },
    },
  ])('rejects an unsupported required $kind', ({ namespace }) => {
    const result = prepareSessionProposal(
      makeProposal({ eip155: namespace }, {}),
      ADDRESS,
    );

    expect(result.status).toBe('unsupported');
    expect(result).toHaveProperty('error');
  });

  it('rejects an unsupported required namespace', () => {
    const result = prepareSessionProposal(makeProposal({
      solana: {
        chains: ['solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ'],
        events: [],
        methods: ['solana_signMessage'],
      },
    }, {}), ADDRESS);

    expect(result.status).toBe('unsupported');
    expect(result).toHaveProperty('error');
  });

  it('does not add a mainnet fallback when namespace chains are omitted', () => {
    const requiredResult = prepareSessionProposal(makeProposal({
      eip155: {
        events: [],
        methods: [EIP155_SIGNING_METHODS.PERSONAL_SIGN],
      },
    }, {}), ADDRESS);
    const optionalResult = prepareSessionProposal(makeProposal({}, {
      eip155: {
        events: [],
        methods: [EIP155_SIGNING_METHODS.PERSONAL_SIGN],
      },
    }), ADDRESS);

    expect(requiredResult).toEqual({ status: 'unsupported' });
    expect(optionalResult).toEqual({ status: 'unsupported' });
  });

  it('keeps supported required capabilities when all optional chains are unsupported', () => {
    const result = getReadyResult({
      eip155: {
        chains: ['eip155:1'],
        events: [],
        methods: [EIP155_SIGNING_METHODS.PERSONAL_SIGN],
      },
    }, {
      eip155: {
        chains: ['eip155:43114'],
        events: ['message'],
        methods: ['wallet_sendCalls'],
      },
    });

    expect(result.namespaces.eip155).toEqual({
      accounts: [`eip155:1:${ADDRESS}`],
      chains: ['eip155:1'],
      events: [],
      methods: [EIP155_SIGNING_METHODS.PERSONAL_SIGN],
    });
  });

  it('omits unsupported optional actions but keeps a supported optional chain', () => {
    const result = getReadyResult({}, {
      eip155: {
        chains: ['eip155:10'],
        events: ['message'],
        methods: ['wallet_sendCalls'],
      },
    });

    expect(result.namespaces.eip155).toEqual({
      accounts: [`eip155:10:${ADDRESS}`],
      chains: ['eip155:10'],
      events: [],
      methods: [],
    });
    expect(result.readOnly).toBe(true);
  });

  it('rejects a proposal when no optional chain is supported', () => {
    const result = prepareSessionProposal(makeProposal({}, {
      eip155: {
        chains: ['eip155:43114'],
        events: [],
        methods: [EIP155_SIGNING_METHODS.PERSONAL_SIGN],
      },
    }), ADDRESS);

    expect(result).toEqual({ status: 'unsupported' });
  });

  it('creates a read-only session when the proposal namespaces are empty', () => {
    const result = getReadyResult({}, {});
    const chains = Object.keys(SUPPORTED_CHAINS);

    expect(result.readOnly).toBe(true);
    expect(result.chains).toEqual(chains);
    expect(result.namespaces.eip155).toEqual({
      accounts: chains.map(chain => `${chain}:${ADDRESS}`),
      chains,
      events: [],
      methods: [],
    });
  });
});
