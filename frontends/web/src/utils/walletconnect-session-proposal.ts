// SPDX-License-Identifier: Apache-2.0

import { ProposalTypes, SessionTypes } from '@walletconnect/types';
import { buildApprovedNamespaces } from '@walletconnect/utils';
import {
  EIP155_SUPPORTED_EVENTS,
  EIP155_SUPPORTED_METHODS,
  SUPPORTED_CHAINS,
} from './walletconnect';

export type TSessionProposalResult = {
  status: 'ready';
  chains: string[];
  namespaces: SessionTypes.Namespaces;
  readOnly: boolean;
} | {
  status: 'unsupported';
  error?: unknown;
};

const hasNoRequestedNamespaces = (proposal: ProposalTypes.Struct) =>
  Object.keys(proposal.requiredNamespaces).length === 0 &&
  Object.keys(proposal.optionalNamespaces).length === 0;

const getSupportedEIP155Namespace = (
  receiveAddress: string,
  emptyProposal: boolean,
) => {
  const chains = Object.keys(SUPPORTED_CHAINS);
  return {
    accounts: chains.map(chain => `${chain}:${receiveAddress}`),
    chains,
    events: emptyProposal ? [] : [...EIP155_SUPPORTED_EVENTS],
    methods: emptyProposal ? [] : [...EIP155_SUPPORTED_METHODS],
  };
};

export const prepareSessionProposal = (
  proposal: ProposalTypes.Struct,
  receiveAddress: string,
): TSessionProposalResult => {
  const emptyProposal = hasNoRequestedNamespaces(proposal);

  try {
    const namespaces = buildApprovedNamespaces({
      proposal,
      supportedNamespaces: {
        eip155: getSupportedEIP155Namespace(receiveAddress, emptyProposal),
      },
    });
    const eip155 = namespaces.eip155;
    if (!eip155?.chains?.length || !eip155.accounts.length) {
      return { status: 'unsupported' };
    }
    return {
      status: 'ready',
      chains: eip155.chains,
      namespaces,
      readOnly: eip155.methods.length === 0,
    };
  } catch (error) {
    return { status: 'unsupported', error };
  }
};
