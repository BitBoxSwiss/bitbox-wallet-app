// SPDX-License-Identifier: Apache-2.0

import { useCallback, useRef, useState } from 'react';
import type { TBtcSatAmount } from '@/api/coins';

export const useSatFiatAmount = () => {
  const amountRequestId = useRef(0);
  const [inputSatsText, setInputSatsText] = useState('');
  const [inputFiatText, setInputFiatText] = useState('');
  const [amount, setAmount] = useState<TBtcSatAmount>();
  const amountSat = amount?.amount;

  const resetAmountInput = useCallback(() => {
    amountRequestId.current += 1;
    setInputSatsText('');
    setInputFiatText('');
    setAmount(undefined);
  }, []);

  // const convertAmount = useCallback(async (
  //   requestId: number,
  //   source: TAmountSource,
  //   inputAmount: string,
  // ) => {
  //   const response = await getBtcSatAmount({ source, amount: inputAmount });
  //   if (!mounted.current || requestId !== amountRequestId.current) {
  //     return;
  //   }
  //   if (!response.success) {
  //     console.error(`Failed to convert ${source === 'sat' ? 'sats' : 'fiat'} amount:`, response.errorMessage);
  //     return;
  //   }

  //   setAmount(response.amount);
  //   if (source === 'sat') {
  //     setInputFiatText(response.amount.unformattedConversions?.[defaultCurrency] ?? '');
  //   } else {
  //     setInputSatsText(response.amount.amount);
  //   }
  // }, [defaultCurrency, mounted]);

  const handleSatsAmountChange = useCallback((satsText: string) => {
    setInputSatsText(satsText);
    setInputFiatText('');
    setAmount(undefined);

    if (!satsText) {
      return;
    }

    return satsText;
  }, []);

  const handleFiatAmountChange = useCallback((fiatText: string) => {
    setInputFiatText(fiatText);
    setInputSatsText('');
    setAmount(undefined);

    if (!fiatText) {
      return;
    }

    return fiatText;
  }, []);

  return {
    amount,
    amountSat,
    handleFiatAmountChange,
    handleSatsAmountChange,
    inputFiatText,
    inputSatsText,
    resetAmountInput,
  };
};
