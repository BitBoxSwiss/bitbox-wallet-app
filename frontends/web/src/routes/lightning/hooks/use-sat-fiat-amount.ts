// SPDX-License-Identifier: Apache-2.0

import { useCallback, useRef, useState } from 'react';
import type { Fiat } from '@/api/account';
import { getBtcSatAmount, type TBtcSatAmount } from '@/api/coins';
import { useMountedRef } from '@/hooks/mount';

type TProps = {
  defaultCurrency: Fiat;
};

type TAmountSource = 'sat' | 'fiat';

export const useSatFiatAmount = ({ defaultCurrency }: TProps) => {
  const mounted = useMountedRef();
  const amountRequestId = useRef(0);
  const [inputSatsText, setInputSatsText] = useState('');
  const [inputFiatText, setInputFiatText] = useState('');
  const [amount, setAmount] = useState<TBtcSatAmount>();
  const amountSat = amount ? Number(amount.amount) : undefined;

  const resetAmountInput = useCallback(() => {
    amountRequestId.current += 1;
    setInputSatsText('');
    setInputFiatText('');
    setAmount(undefined);
  }, []);

  const convertAmount = useCallback(async (
    requestId: number,
    source: TAmountSource,
    inputAmount: string,
  ) => {
    const response = await getBtcSatAmount({ source, amount: inputAmount });
    if (!mounted.current || requestId !== amountRequestId.current) {
      return;
    }
    if (!response.success) {
      console.error(`Failed to convert ${source === 'sat' ? 'sats' : 'fiat'} amount:`, response.errorMessage);
      return;
    }

    setAmount(response.amount);
    if (source === 'sat') {
      setInputFiatText(response.amount.unformattedConversions?.[defaultCurrency] ?? '');
    } else {
      setInputSatsText(response.amount.amount);
    }
  }, [defaultCurrency, mounted]);

  const handleSatsAmountChange = useCallback((satsText: string) => {
    const requestId = ++amountRequestId.current;
    setInputSatsText(satsText);
    setInputFiatText('');
    setAmount(undefined);

    if (!satsText) {
      return;
    }

    return convertAmount(requestId, 'sat', satsText);
  }, [convertAmount]);

  const handleFiatAmountChange = useCallback((fiatText: string) => {
    const requestId = ++amountRequestId.current;
    setInputFiatText(fiatText);
    setInputSatsText('');
    setAmount(undefined);

    if (!fiatText) {
      return;
    }

    return convertAmount(requestId, 'fiat', fiatText);
  }, [convertAmount]);

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
