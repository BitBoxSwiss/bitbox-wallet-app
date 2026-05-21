// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { convertFromCurrency, convertToCurrency, type BtcUnit } from '@/api/coins';
import type { TTopUpSourceAccount } from '@/api/lightning';
import { usePrevious } from '@/hooks/previous';
import { isBitcoinOnly } from '@/routes/account/utils';
import { TProposalError } from '@/routes/account/send/services';
import { useTxProposal } from '@/routes/account/send/use-tx-proposal';

type TUseTopUpDraftProps = {
  boardingAddress?: string;
  btcUnit?: BtcUnit;
  defaultCurrency: accountApi.Fiat;
  sourceAccount?: TTopUpSourceAccount;
};

export const useTopUpDraft = ({
  boardingAddress,
  btcUnit,
  defaultCurrency,
  sourceAccount,
}: TUseTopUpDraftProps) => {
  const { t } = useTranslation();
  const prevDefaultCurrency = usePrevious(defaultCurrency);
  const prevBtcUnit = usePrevious(btcUnit);

  const [amount, setAmount] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [customFee, setCustomFee] = useState('');
  const [errorHandling, setErrorHandling] = useState<TProposalError>({});
  const [feeTarget, setFeeTarget] = useState<accountApi.FeeTargetCode>();
  const [updateFiat, setUpdateFiat] = useState(true);

  const convertToFiat = useCallback(async (amount: string) => {
    if (!sourceAccount) {
      return;
    }
    if (amount) {
      const data = await convertToCurrency({
        amount,
        coinCode: sourceAccount.coinCode,
        fiatUnit: defaultCurrency,
      });
      if (data.success) {
        setFiatAmount(data.fiatAmount);
      } else {
        setErrorHandling({
          amountError: t('send.error.invalidAmount')
        });
      }
    } else {
      setFiatAmount('');
    }
  }, [defaultCurrency, sourceAccount, t]);

  const convertFromFiat = useCallback(async (amount: string) => {
    if (!sourceAccount) {
      return;
    }
    if (amount) {
      const data = await convertFromCurrency({
        amount,
        coinCode: sourceAccount.coinCode,
        fiatUnit: defaultCurrency,
      });
      if (data.success) {
        setAmount(data.amount);
        setUpdateFiat(false);
      } else {
        setErrorHandling({ amountError: t('send.error.invalidAmount') });
      }
    } else {
      setAmount('');
    }
  }, [defaultCurrency, sourceAccount, t]);

  const getValidTxInputData = useCallback((): Required<accountApi.TTxInput> | false => {
    if (
      !sourceAccount
      || !boardingAddress
      || feeTarget === undefined
      || !amount
      || (feeTarget === 'custom' && !customFee)
    ) {
      return false;
    }
    return {
      address: boardingAddress,
      amount,
      feeTarget,
      customFee,
      sendAll: 'no',
      selectedUTXOs: [],
      paymentRequest: null,
      useHighestFee: false
    };
  }, [amount, boardingAddress, customFee, feeTarget, sourceAccount]);

  const {
    cancelPendingProposal,
    clearProposal,
    isUpdatingProposal,
    proposedAmount,
    proposedFee,
    proposedTotal,
    recipientDisplayAddress,
    valid,
    validateAndDisplayFee,
  } = useTxProposal({
    accountCode: sourceAccount?.code,
    clearOnInvalidInput: true,
    getValidTxInputData,
    onProposedAmount: convertToFiat,
    setErrorHandling,
  });

  useEffect(() => {
    validateAndDisplayFee(updateFiat);
  }, [amount, customFee, feeTarget, updateFiat, validateAndDisplayFee]);

  useEffect(() => {
    if (!sourceAccount) {
      return;
    }

    const currencyChanged = prevDefaultCurrency !== undefined && prevDefaultCurrency !== defaultCurrency;
    const btcUnitChanged = prevBtcUnit !== undefined && prevBtcUnit !== btcUnit;

    if (!currencyChanged && !btcUnitChanged) {
      return;
    }

    if (btcUnitChanged && isBitcoinOnly(sourceAccount.coinCode) && amount) {
      const fiatUnit = prevBtcUnit === 'default' ? 'BTC' : 'sat';
      convertFromCurrency({
        amount,
        coinCode: sourceAccount.coinCode,
        fiatUnit
      }).then((data) => {
        if (data.success) {
          setAmount(data.amount);
          setUpdateFiat(false);
        } else {
          setErrorHandling({ amountError: t('send.error.invalidAmount') });
        }
      }).catch(() => {
        setErrorHandling({ amountError: t('send.error.invalidAmount') });
      });
      return;
    }

    if (currencyChanged) {
      convertToFiat(amount);
    }
  }, [
    amount,
    btcUnit,
    convertToFiat,
    defaultCurrency,
    prevBtcUnit,
    prevDefaultCurrency,
    sourceAccount,
    t,
  ]);

  const handleCoinAmountChange = (amount: string) => {
    setAmount(amount);
    convertToFiat(amount);
    setUpdateFiat(true);
  };

  const handleFiatInput = (fiatAmount: string) => {
    setFiatAmount(fiatAmount);
    convertFromFiat(fiatAmount);
  };

  const handleFeeTargetChange = (feeTarget: accountApi.FeeTargetCode) => {
    setFeeTarget(feeTarget);
    setCustomFee('');
    setUpdateFiat(true);
  };

  const handleCustomFee = (customFee: string) => {
    setCustomFee(customFee);
    setUpdateFiat(false);
  };

  const resetProposal = () => {
    cancelPendingProposal();
    setCustomFee('');
    setFeeTarget(undefined);
    clearProposal();
    setUpdateFiat(true);
  };

  return {
    amount,
    customFee,
    errorHandling,
    feeTarget,
    fiatAmount,
    getValidTxInputData,
    handleCoinAmountChange,
    handleCustomFee,
    handleFeeTargetChange,
    handleFiatInput,
    isUpdatingProposal,
    proposedAmount,
    proposedFee,
    proposedTotal,
    recipientDisplayAddress,
    resetProposal,
    sendDisabled: !getValidTxInputData() || !valid || isUpdatingProposal,
  };
};
