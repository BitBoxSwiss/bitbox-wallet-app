// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { connectKeystore } from '@/api/keystores';
import { AccountCode, ScriptType, TReceiveAddress } from '@/api/account';
import { isEthereumBased } from '../utils';

export type TSigningState = 'input' | 'signing' | 'result';

export type TSignatureResult = {
  address: string;
  message: string;
  signature: string;
};

type UseSignMessageParams = {
  accountCode: AccountCode;
  coinCode?: accountApi.CoinCode;
  address: TReceiveAddress | null;
  rootFingerprint?: string;
  scriptType?: ScriptType | null;
};

type UseSignMessageReturn = {
  message: string;
  setMessage: (msg: string) => void;
  state: TSigningState;
  error: string | null;
  result: TSignatureResult | null;
  isTaprootAddress: boolean;
  handleSign: () => Promise<void>;
  reset: () => void;
};

export const useSignMessage = ({
  accountCode,
  coinCode,
  address,
  rootFingerprint,
  scriptType,
}: UseSignMessageParams): UseSignMessageReturn => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [state, setState] = useState<TSigningState>('input');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TSignatureResult | null>(null);

  const isTaproot = scriptType === 'p2tr';

  const signingRef = useRef(false);

  const handleSign = useCallback(async () => {
    if (!address || !rootFingerprint || signingRef.current) {
      return;
    }

    setError(null);

    if (!message.trim()) {
      setError(t('signMessage.emptyMessage'));
      return;
    }

    signingRef.current = true;
    try {
      const connectResult = await connectKeystore(rootFingerprint);
      if (!connectResult.success) {
        return;
      }

      setState('signing');

      const response = coinCode && isEthereumBased(coinCode)
        ? await accountApi.signETHMessageForAddress(accountCode, message)
        : await accountApi.signBTCMessageForAddress(
          accountCode,
          address.addressID,
          message,
        );

      if (response.success) {
        setResult({
          address: response.address,
          message,
          signature: response.signature,
        });
        setState('result');
        return;
      }

      if (response.errorCode !== 'userAbort') {
        setError(response.errorMessage || t('signMessage.error'));
      }
      setState('input');
    } catch {
      setError(t('signMessage.error'));
      setState('input');
    } finally {
      signingRef.current = false;
    }
  }, [accountCode, address, coinCode, message, rootFingerprint, t]);

  const reset = useCallback(() => {
    setMessage('');
    setState('input');
    setError(null);
    setResult(null);
  }, []);

  return {
    message,
    setMessage,
    state,
    error,
    result,
    isTaprootAddress: isTaproot,
    handleSign,
    reset,
  };
};
