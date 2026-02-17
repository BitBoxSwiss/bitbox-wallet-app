// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { AccountCode, ScriptType, TReceiveAddress } from '@/api/account';

export type TSigningState = 'input' | 'signing' | 'result';

export type TSignatureResult = {
  address: string;
  message: string;
  signature: string;
};

type UseSignMessageParams = {
  accountCode: AccountCode;
  address: TReceiveAddress | null;
  onClose?: () => void;
  scriptType?: ScriptType | null;
};

type UseSignMessageReturn = {
  message: string;
  setMessage: (msg: string) => void;
  state: TSigningState;
  error: string | null;
  result: TSignatureResult | null;
  isUnsupported: boolean;
  isTaproot: boolean;
  handleSign: () => Promise<void>;
  reset: () => void;
};

export const useSignMessage = ({
  accountCode,
  address,
  onClose,
  scriptType,
}: UseSignMessageParams): UseSignMessageReturn => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [state, setState] = useState<TSigningState>('input');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TSignatureResult | null>(null);

  const isTaproot = scriptType === 'p2tr';
  const isUnsupported = isTaproot;

  const handleSign = useCallback(async () => {
    if (!address) {
      return;
    }

    setError(null);

    if (!message.trim()) {
      setError(t('receive.signMessage.emptyMessage'));
      return;
    }

    setState('signing');

    try {
      const response = await accountApi.signMessage(
        accountCode,
        address.addressID,
        message,
      );

      if (response.success) {
        setResult({
          address: response.address,
          message: message,
          signature: response.signature,
        });
        setState('result');
      } else {
        if (response.errorCode === 'userAbort') {
          setError(null);
          setState('input');
          onClose?.();
          return;
        } else if (response.errorCode === 'wrongKeystore') {
          setError(t('receive.signMessage.wrongKeystore'));
          setState('input');
        } else {
          setError(response.errorMessage || t('receive.signMessage.error'));
          setState('input');
        }
      }
    } catch (err) {
      setError(t('receive.signMessage.error'));
      setState('input');
    }
  }, [accountCode, address, message, onClose, t]);

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
    isUnsupported,
    isTaproot,
    handleSign,
    reset,
  };
};
