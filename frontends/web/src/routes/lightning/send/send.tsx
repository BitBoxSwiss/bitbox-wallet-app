// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '../../../api/account';
import { Column, Grid, GuideWrapper, GuidedContent, Header, Main } from '../../../components/layout';
import { View, ViewButtons, ViewContent, ViewHeader } from '../../../components/view/view';
import { Button, Input } from '../../../components/forms';
import { TInputType, TInputTypeVariant, TLightningInvoice, TSdkError, getParsePaymentInput, postSendPayment } from '../../../api/lightning';
import { SimpleMarkup } from '../../../utils/markup';
import { Amount } from '../../../components/amount/amount';
import { Status } from '../../../components/status/status';
import { ScanQRVideo } from '../../account/send/components/inputs/scan-qr-video';
import { Spinner } from '../../../components/spinner/Spinner';
import { getBtcSatsAmount } from '../../../api/coins';
import { Skeleton } from '../../../components/skeleton/skeleton';
import { runningInAndroid, runningInIOS } from '@/utils/env';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import styles from './send.module.css';
import { useNavigate } from 'react-router-dom';

type TStep = 'select-invoice' | 'edit-invoice' | 'confirm' | 'sending' | 'success';

const SendingSpinner = () => {
  const { t } = useTranslation();
  // Show dummy connecting-to-server message first
  const [message, setStep] = useState<string>(t('lightning.send.sending.connecting'));

  setTimeout(() => {
    setStep(t('lightning.send.sending.message'));
  }, 1000);

  return <Spinner text={message} />;
};

type InvoiceInputProps = {
  invoice: TLightningInvoice;
};

const InvoiceInput = ({ invoice }: InvoiceInputProps) => {
  const { t } = useTranslation();
  const [invoiceAmount, setInvoiceAmount] = useState<accountApi.TAmountWithConversions>();

  useEffect(() => {
    getBtcSatsAmount((invoice.amountSat || 0).toString()).then((response) => {
      if (response.success) {
        setInvoiceAmount(response.amount);
      }
    });
  }, [invoice]);
  return (
    <>
      <h1 className={styles.title}>{t('lightning.send.confirm.title')}</h1>
      <div className={styles.info}>
        <h2 className={styles.label}>{t('lightning.send.confirm.amount')}</h2>
        {invoiceAmount ? (
          <>
            <Amount amount={invoiceAmount.amount} unit={invoiceAmount.unit} />{' ' + invoiceAmount.unit}/{' '}
            <AmountWithUnit amount={invoiceAmount} convertToFiat/>
          </>
        ) : <Skeleton />};
      </div>
      {invoice.description && (
        <div className={styles.info}>
          <h2 className={styles.label}>{t('lightning.send.confirm.memo')}</h2>
          {invoice.description}
        </div>
      )}
    </>);
};

type PaymentInputProps = {
  input: TInputType;
};

const PaymentInput = ({ input }: PaymentInputProps) => {
  switch (input.type) {
  case TInputTypeVariant.BOLT11:
    return (
      <InvoiceInput invoice={input.invoice} />
    );
  }
};

type SendWorkflowProps = {
  onBack: () => void;
  onInvoiceInput: (input: string) => void;
  onCustomAmount: (input: number) => void;
  onSend: () => void;
  parsedInput?: TInputType;
  inputError?: string;
  customAmount?: number;
  step: TStep;
};

const SendWorkflow = ({
  onBack,
  onInvoiceInput,
  onCustomAmount,
  onSend,
  parsedInput,
  inputError,
  customAmount,
  step,
}: SendWorkflowProps) => {
  const { t } = useTranslation();
  const [lnInvoice, setLnInvoice] = useState('');

  // Memoize the ScanQRVideo component to prevent unnecessary re-renders due to state updates.
  const memoizedScanQRVideo = useMemo(() => (
    <ScanQRVideo onResult={onInvoiceInput} />
  ), [onInvoiceInput]);

  switch (step) {
  case 'select-invoice':
    return (
      <View textCenter width="660px" >
        <ViewHeader title="Scan lightning invoice" />
        <ViewContent textAlign="center">
          <Grid col="1">
            <Column className={styles.camera}>
              { /* we need a cointainer for the error with a fixed height to avoid
                layout shifts, that would cause the yellow target on the video
                component to become misaligned due to the fact that it is memoized
                and so it doesn't re-render when inputError changes.*/ }
              <div className={styles.error}>
                {inputError && <Status dismissible="" type="warning">{inputError}</Status>}
              </div>
              {memoizedScanQRVideo}
              <Input
                placeholder={t('lightning.send.invoice.input')}
                onInput={(e: ChangeEvent<HTMLInputElement>) => setLnInvoice(e.target.value)}
                value={lnInvoice}
                // to prevent the virtual Android/iOS keyboard to be displayed by default.
                autoFocus={!runningInAndroid() && !runningInIOS()}/>
            </Column>
          </Grid>
        </ViewContent>
        <ViewButtons>
          <Button disabled={!lnInvoice} primary onClick={() => {
            onInvoiceInput(lnInvoice);
            setLnInvoice('');
          }}>
            {t('generic.send')}
          </Button>
          <Button secondary onClick={onBack}>
            {t('button.back')}
          </Button>
        </ViewButtons>
      </View>
    );
  case 'edit-invoice':
    if (parsedInput?.type !== TInputTypeVariant.BOLT11) {
      return (
        <View fitContent minHeight="100%">
          Invoices without amount are currently only supported for BOLT11 type invoices
        </View>
      );
    }
    return (
      <View fitContent minHeight="100%">
        <ViewContent>
          <Grid col="1">
            <Column>
              <Input
                type="number"
                min="0"
                label={t('lightning.receive.amountSats.label')}
                placeholder={t('lightning.receive.amountSats.placeholder')}
                id="amountSatsInput"
                onInput={e => onCustomAmount(e.target.valueAsNumber)}
                value={customAmount ? `${customAmount}` : ''}
                autoFocus
              />
              <Input
                type="text"
                label={t('lightning.receive.description.label')}
                placeholder="This invoice has no description"
                id="descriptionInput"
                readOnly
                disabled
                value={parsedInput.invoice.description}
              />
            </Column>
          </Grid>
        </ViewContent>
        <ViewButtons>
          <Button
            primary
            onClick={onSend}
            disabled={!customAmount}>
            {t('generic.send')}
          </Button>
          <Button secondary onClick={onBack}>
            {t('button.back')}
          </Button>
        </ViewButtons>
      </View>
    );
  case 'confirm':
    if (!parsedInput) {
      return 'no invoice found';
    }
    return (
      <View fitContent minHeight="100%">
        <ViewContent>
          <Grid col="1">
            <Column>
              <PaymentInput input={parsedInput} />
            </Column>
          </Grid>
        </ViewContent>
        <ViewButtons>
          <Button primary onClick={onSend}>
            {t('generic.send')}
          </Button>
          <Button secondary onClick={onBack}>
            {t('button.back')}
          </Button>
        </ViewButtons>
      </View>
    );
  case 'sending':
    return <SendingSpinner />;
  case 'success':
    return (
      <View fitContent textCenter verticallyCentered>
        <ViewContent withIcon="success">
          <SimpleMarkup className={styles.successMessage} markup={t('lightning.send.success.message')} tagName="p" />
        </ViewContent>
      </View>
    );
  }
};

export const Send = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<TStep>('select-invoice');
  const [paymentDetails, setPaymentDetails] = useState<TInputType>();
  const [customAmount, setCustomAmount] = useState<number>();
  const [rawInputError, setRawInputError] = useState<string>();
  const [sendError, setSendError] = useState<string>();

  const back = () => {
    switch (step) {
    case 'select-invoice':
    case 'confirm':
      navigate('/lightning');
      break;
    case 'edit-invoice':
    case 'success':
      setStep('select-invoice');
      setSendError(undefined);
      setPaymentDetails(undefined);
      break;
    }
  };

  const parsePaymentInput = useCallback(async (rawInput: string) => {
    setRawInputError(undefined);
    try {
      const result = await getParsePaymentInput({ s: rawInput });
      switch (result.type) {
      case TInputTypeVariant.BOLT11:
        setPaymentDetails(result);
        // if invoice has 0 amount or no amount given
        if (!result.invoice.amountSat) {
          setCustomAmount(0);
          setStep('edit-invoice');
          break;
        }
        setStep('confirm');
        break;
      default:
        setRawInputError('Invalid input');
      }
    } catch (e) {
      if (e instanceof TSdkError) {
        setRawInputError(e.message);
      } else {
        setRawInputError(String(e));
      }
    }
  }, []);

  const sendPayment = async () => {
    setStep('sending');
    setSendError(undefined);
    try {
      switch (paymentDetails?.type) {
      case TInputTypeVariant.BOLT11:
        await postSendPayment({
          bolt11: paymentDetails.invoice.bolt11,
          amountSat: customAmount || undefined
        });
        setStep('success');
        setTimeout(() => navigate('/lightning'), 1000);
        break;
      }
    } catch (e) {
      setStep('select-invoice');
      if (e instanceof TSdkError) {
        setSendError(e.message);
      } else {
        setSendError(String(e));
      }
    }
  };

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Status dismissible="" type="warning" hidden={!sendError}>
            {sendError}
          </Status>
          <Header title={<h2>{t('lightning.send.title')}</h2>} />
          <SendWorkflow
            onBack={back}
            onInvoiceInput={parsePaymentInput}
            onCustomAmount={setCustomAmount}
            onSend={sendPayment}
            parsedInput={paymentDetails}
            inputError={rawInputError}
            customAmount={customAmount}
            step={step}
          />
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};
