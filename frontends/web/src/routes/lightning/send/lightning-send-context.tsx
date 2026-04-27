// SPDX-License-Identifier: Apache-2.0

import { ReactNode, createContext, useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TPaymentInputType,
  TPaymentInputTypeVariant,
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
  paymentDetails?: TPaymentInputType;
  paymentQuote?: TPreparePaymentResponse;
  preparePayment: () => Promise<void>;
  resetPayment: () => void;
  returnToEditInvoice: () => void;
  sendError?: string;
  sendPayment: () => Promise<void>;
  setCustomAmount: (amount?: number) => void;
  step: TSendStep;
  parsePaymentInput: (rawInput: string) => Promise<boolean>;
};

const isValidCustomAmount = (amount?: number): amount is number => (
  typeof amount === 'number' && Number.isFinite(amount) && Number.isInteger(amount) && amount > 0
);

const LightningSendContext = createContext<TLightningSendContext | null>(null);

type TProps = {
  children: ReactNode;
};

export const LightningSendProvider = ({ children }: TProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<TSendStep>('select-invoice');
  const [paymentDetails, setPaymentDetails] = useState<TPaymentInputType>();
  const [paymentQuote, setPaymentQuote] = useState<TPreparePaymentResponse>();
  const [customAmount, setCustomAmount] = useState<number>();
  const [inputError, setInputError] = useState<string>();
  const [sendError, setSendError] = useState<string>();

  const toErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof TSdkError && error.code) {
      return t(`error.${error.code}`);
    }
    return String(error);
  }, [t]);

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
    nextPaymentDetails?: TPaymentInputType,
    nextCustomAmount?: number,
    prepareErrorMessage?: string,
  ) => {
    const currentPaymentDetails = nextPaymentDetails || paymentDetails;
    if (currentPaymentDetails?.type !== TPaymentInputTypeVariant.BOLT11) {
      return;
    }
    if (!currentPaymentDetails.invoice.amountSat && !isValidCustomAmount(nextCustomAmount)) {
      setSendError(t('send.error.invalidAmount'));
      return;
    }

    setStep('preparing');
    setSendError(prepareErrorMessage);

    try {
      const quote = await postPreparePayment({
        bolt11: currentPaymentDetails.invoice.bolt11,
        amountSat: nextCustomAmount === undefined ? undefined : nextCustomAmount,
      });
      setPaymentQuote(quote);
      setStep('confirm');
    } catch (error) {
      setStep('select-invoice');
      setPaymentQuote(undefined);
      setSendError(toErrorMessage(error));
    }
  }, [paymentDetails, toErrorMessage, t]);

  const parsePaymentInput = useCallback(async (rawInput: string) => {
    setInputError(undefined);
    setSendError(undefined);
    setPaymentQuote(undefined);

    try {
      const result = await getParsePaymentInput({ s: rawInput });
      setPaymentDetails(result);

      if (result.type === TPaymentInputTypeVariant.BOLT11 && !result.invoice.amountSat) {
        setCustomAmount(0);
        setStep('edit-invoice');
        return true;
      }

      setCustomAmount(undefined);
      preparePayment(result);
      return true;
    } catch (error) {
      setInputError(toErrorMessage(error));
      return false;
    }
  }, [preparePayment, toErrorMessage]);

  const sendPayment = useCallback(async () => {
    if (paymentDetails?.type !== TPaymentInputTypeVariant.BOLT11) {
      return;
    }
    if (!paymentQuote) {
      return;
    }

    if (!paymentDetails.invoice.amountSat && !isValidCustomAmount(customAmount)) {
      setSendError(t('send.error.invalidAmount'));
      return;
    }

    setStep('sending');
    setSendError(undefined);

    try {
      await postSendPayment({
        bolt11: paymentDetails.invoice.bolt11,
        amountSat: paymentDetails.invoice.amountSat ? undefined : customAmount,
        approvedFeeSat: paymentQuote.feeSat,
      });
      setStep('success');
    } catch (error) {
      if (error instanceof TSdkError && error.code === 'paymentApprovalRequired') {
        preparePayment(paymentDetails, customAmount, toErrorMessage(error));
        return;
      }
      setStep('select-invoice');
      setPaymentQuote(undefined);
      setSendError(toErrorMessage(error));
    }
  }, [customAmount, paymentDetails, paymentQuote, preparePayment, toErrorMessage, t]);

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
