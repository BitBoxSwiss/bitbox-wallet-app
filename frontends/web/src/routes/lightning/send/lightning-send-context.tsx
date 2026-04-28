// SPDX-License-Identifier: Apache-2.0

import { ReactNode, createContext, useCallback, useContext, useState } from 'react';
import {
  TInputType,
  TInputTypeVariant,
  TSdkError,
  getParsePaymentInput,
  postSendPayment,
} from '@/api/lightning';

type TSendStep = 'select-invoice' | 'edit-invoice' | 'confirm' | 'sending' | 'success';

type TLightningSendContext = {
  customAmount?: number;
  inputError?: string;
  paymentDetails?: TInputType;
  resetPayment: () => void;
  sendError?: string;
  sendPayment: () => Promise<void>;
  setCustomAmount: (amount?: number) => void;
  step: TSendStep;
  parsePaymentInput: (rawInput: string) => Promise<void>;
};

const errorMessage = (error: unknown): string => {
  if (error instanceof TSdkError) {
    return error.message;
  }
  return String(error);
};

const LightningSendContext = createContext<TLightningSendContext | null>(null);

type TProps = {
  children: ReactNode;
};

export const LightningSendProvider = ({ children }: TProps) => {
  const [step, setStep] = useState<TSendStep>('select-invoice');
  const [paymentDetails, setPaymentDetails] = useState<TInputType>();
  const [customAmount, setCustomAmount] = useState<number>();
  const [inputError, setInputError] = useState<string>();
  const [sendError, setSendError] = useState<string>();

  const resetPayment = useCallback(() => {
    setStep('select-invoice');
    setPaymentDetails(undefined);
    setCustomAmount(undefined);
    setInputError(undefined);
    setSendError(undefined);
  }, []);

  const parsePaymentInput = useCallback(async (rawInput: string) => {
    setInputError(undefined);
    setSendError(undefined);

    try {
      const result = await getParsePaymentInput({ s: rawInput });
      setPaymentDetails(result);

      if (result.type === TInputTypeVariant.BOLT11 && !result.invoice.amountSat) {
        setCustomAmount(0);
        setStep('edit-invoice');
        return;
      }

      setCustomAmount(undefined);
      setStep('confirm');
    } catch (error) {
      setInputError(errorMessage(error));
    }
  }, []);

  const sendPayment = useCallback(async () => {
    if (paymentDetails?.type !== TInputTypeVariant.BOLT11) {
      return;
    }

    setStep('sending');
    setSendError(undefined);

    try {
      await postSendPayment({
        bolt11: paymentDetails.invoice.bolt11,
        amountSat: customAmount || undefined,
      });
      setStep('success');
    } catch (error) {
      setStep('select-invoice');
      setSendError(errorMessage(error));
    }
  }, [customAmount, paymentDetails]);

  return (
    <LightningSendContext.Provider value={{
      customAmount,
      inputError,
      paymentDetails,
      resetPayment,
      sendError,
      sendPayment,
      setCustomAmount,
      step,
      parsePaymentInput,
    }}>
      {children}
    </LightningSendContext.Provider>
  );
};

export const useLightningSendContext = () => {
  const context = useContext(LightningSendContext);
  if (context === null) {
    throw new Error('useLightningSendContext must be used within LightningSendProvider');
  }
  return context;
};
