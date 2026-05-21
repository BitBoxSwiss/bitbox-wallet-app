// SPDX-License-Identifier: Apache-2.0

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as accountApi from '@/api/account';
import { TProposalError, txProposalErrorHandling } from './services';

type TUseTxProposalProps = {
  accountCode?: accountApi.AccountCode;
  clearFeeOnError?: (errorHandling: TProposalError) => boolean;
  clearOnInvalidInput?: boolean;
  getValidTxInputData: () => Required<accountApi.TTxInput> | false;
  onProposedAmount?: (amount: string) => void;
  setErrorHandling: Dispatch<SetStateAction<TProposalError>>;
};

const clearFeeOnErrorDefault = () => true;

export const useTxProposal = ({
  accountCode,
  clearFeeOnError = clearFeeOnErrorDefault,
  clearOnInvalidInput = false,
  getValidTxInputData,
  onProposedAmount,
  setErrorHandling,
}: TUseTxProposalProps) => {
  const lastProposal = useRef<Promise<accountApi.TTxProposalResult> | null>(null);
  const proposeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [valid, setValid] = useState(false);
  const [isUpdatingProposal, setIsUpdatingProposal] = useState(false);
  const [proposedFee, setProposedFee] = useState<accountApi.TAmountWithConversions>();
  const [proposedTotal, setProposedTotal] = useState<accountApi.TAmountWithConversions>();
  const [proposedAmount, setProposedAmount] = useState<accountApi.TAmountWithConversions>();
  const [recipientDisplayAddress, setRecipientDisplayAddress] = useState('');

  const cancelPendingProposal = useCallback(() => {
    if (proposeTimeout.current) {
      clearTimeout(proposeTimeout.current);
      proposeTimeout.current = null;
    }
    lastProposal.current = null;
    setIsUpdatingProposal(false);
  }, []);

  useEffect(() => () => {
    if (proposeTimeout.current) {
      clearTimeout(proposeTimeout.current);
      proposeTimeout.current = null;
    }
    lastProposal.current = null;
  }, []);

  const clearProposal = useCallback(() => {
    setValid(false);
    setIsUpdatingProposal(false);
    setProposedAmount(undefined);
    setProposedFee(undefined);
    setProposedTotal(undefined);
    setRecipientDisplayAddress('');
  }, []);

  const handleProposal = useCallback((
    updateFiat: boolean,
    result: accountApi.TTxProposalResult,
  ) => {
    setValid(result.success);
    if (result.success) {
      setErrorHandling({});
      setProposedFee(result.fee);
      setProposedAmount(result.amount);
      setProposedTotal(result.total);
      setRecipientDisplayAddress(result.recipientDisplayAddress);
      setIsUpdatingProposal(false);
      if (updateFiat) {
        onProposedAmount?.(result.amount.amount);
      }
      return;
    }

    const nextErrorHandling = txProposalErrorHandling(result.errorCode);
    setErrorHandling(nextErrorHandling);
    setIsUpdatingProposal(false);

    if (clearFeeOnError(nextErrorHandling)) {
      setProposedFee(undefined);
    }
    setRecipientDisplayAddress('');
  }, [clearFeeOnError, onProposedAmount, setErrorHandling]);

  const validateAndDisplayFee = useCallback((
    updateFiat: boolean = true,
  ) => {
    cancelPendingProposal();
    setProposedTotal(undefined);
    setErrorHandling({});
    const txInput = getValidTxInputData();
    if (!txInput || !accountCode) {
      if (clearOnInvalidInput) {
        clearProposal();
      }
      return;
    }
    setIsUpdatingProposal(true);
    proposeTimeout.current = setTimeout(async () => {
      let proposePromise: Promise<accountApi.TTxProposalResult> | null = null;
      try {
        proposePromise = accountApi.proposeTx(accountCode, txInput);
        lastProposal.current = proposePromise;
        const result = await proposePromise;
        if (proposePromise === lastProposal.current) {
          handleProposal(updateFiat, result);
        }
      } catch (error) {
        if (proposePromise === lastProposal.current) {
          setValid(false);
          setIsUpdatingProposal(false);
          console.error('Failed to propose transaction:', error);
        }
      } finally {
        if (proposePromise === lastProposal.current) {
          lastProposal.current = null;
          setIsUpdatingProposal(false);
        }
      }
    }, 400);
  }, [
    accountCode,
    cancelPendingProposal,
    clearOnInvalidInput,
    clearProposal,
    getValidTxInputData,
    handleProposal,
    setErrorHandling,
  ]);

  return {
    cancelPendingProposal,
    clearProposal,
    isUpdatingProposal,
    proposedAmount,
    proposedFee,
    proposedTotal,
    recipientDisplayAddress,
    setRecipientDisplayAddress,
    valid,
    validateAndDisplayFee,
  };
};
