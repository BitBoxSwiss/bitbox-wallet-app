// SPDX-License-Identifier: Apache-2.0

import { ReactNode, createContext, useCallback, useContext, useState } from 'react';
import {
  TInputType,
  TInputTypeVariant,
  TPreparePaymentResponse,
  TSdkError,
  getParsePaymentInput,
  postPreparePayment,
  postSendPayment,
} from '@/api/lightning';

type TSendStep = 'select-invoice' | 'edit-invoice' | 'preparing' | 'confirm' | 'sending' | 'success';

type TLightningSendContext = {
  customAmount?: number;
  inputError?: string;
  paymentDetails?: TInputType;
  paymentQuote?: TPreparePaymentResponse;
  preparePayment: () => Promise<void>;
  resetPayment: () => void;
  returnToEditInvoice: () => void;
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
  const [paymentQuote, setPaymentQuote] = useState<TPreparePaymentResponse>();
  const [customAmount, setCustomAmount] = useState<number>();
  const [inputError, setInputError] = useState<string>();
  const [sendError, setSendError] = useState<string>();

  const resetPayment = useCallback(() => {
    setStep('select-invoice');
    setPaymentDetails(undefined);
    setPaymentQuote(undefined);
    setCustomAmount(undefined);
    setInputError(undefined);
    setSendError(undefined);
  }, []);

  const returnToEditInvoice = useCallback(() => {
    setPaymentQuote(undefined);
    setSendError(undefined);
    setStep('edit-invoice');
  }, []);

  const preparePayment = useCallback(async (
    nextPaymentDetails?: TInputType,
    nextCustomAmount?: number,
    prepareErrorMessage?: string,
  ) => {
    const currentPaymentDetails = nextPaymentDetails || paymentDetails;
    if (currentPaymentDetails?.type !== TInputTypeVariant.BOLT11) {
      return;
    }

    setStep('preparing');
    setSendError(prepareErrorMessage);

    try {
      const quote = await postPreparePayment({
        bolt11: currentPaymentDetails.invoice.bolt11,
        amountSat: nextCustomAmount || undefined,
      });
      setPaymentQuote(quote);
      setStep('confirm');
    } catch (error) {
      setStep('select-invoice');
      setPaymentQuote(undefined);
      setSendError(errorMessage(error));
    }
  }, [paymentDetails]);

  const parsePaymentInput = useCallback(async (rawInput: string) => {
    setInputError(undefined);
    setSendError(undefined);
    setPaymentQuote(undefined);

    try {
      const result = await getParsePaymentInput({ s: rawInput });
      setPaymentDetails(result);

      if (result.type === TInputTypeVariant.BOLT11 && !result.invoice.amountSat) {
        setCustomAmount(0);
        setStep('edit-invoice');
        return;
      }

      setCustomAmount(undefined);
      void preparePayment(result);
    } catch (error) {
      setInputError(errorMessage(error));
    }
  }, [preparePayment]);

  const sendPayment = useCallback(async () => {
    if (paymentDetails?.type !== TInputTypeVariant.BOLT11) {
      return;
    }
    if (!paymentQuote) {
      return;
    }

    setStep('sending');
    setSendError(undefined);

    try {
      await postSendPayment({
        bolt11: paymentDetails.invoice.bolt11,
        amountSat: customAmount || undefined,
        approvedFeeSat: paymentQuote.feeSat,
      });
      setStep('success');
    } catch (error) {
      if (error instanceof TSdkError && error.code === 'paymentApprovalRequired') {
        void preparePayment(paymentDetails, customAmount, error.message);
        return;
      }
      setStep('select-invoice');
      setPaymentQuote(undefined);
      setSendError(errorMessage(error));
    }
  }, [customAmount, paymentDetails, paymentQuote, preparePayment]);

  return (
    <LightningSendContext.Provider value={{
      customAmount,
      inputError,
      paymentDetails,
      paymentQuote,
      preparePayment: async () => preparePayment(undefined, customAmount),
      resetPayment,
      returnToEditInvoice,
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
