// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Column, Grid, GuideWrapper, GuidedContent, Header, Main } from '../../../components/layout';
import { View, ViewButtons, ViewContent } from '../../../components/view/view';
import { Button, Input, NumberInput, OptionalLabel } from '../../../components/forms';
import {
  TLightningPayment,
  TReceivePaymentResponse,
  TSdkError,
  getListPayments,
  getReceivePayment,
  subscribeListPayments
} from '../../../api/lightning';
import { getBtcSatAmount, type TBtcSatAmount } from '@/api/coins';
import { Status } from '../../../components/status/status';
import { QRCode } from '../../../components/qrcode/qrcode';
import { unsubscribe } from '../../../utils/subscriptions';
import { Spinner } from '../../../components/spinner/Spinner';
import { Checked, Copy, EditActive } from '../../../components/icon';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { useNavigate } from 'react-router-dom';
import { RatesContext } from '@/contexts/RatesContext';
import { useMountedRef } from '@/hooks/mount';
import styles from './receive.module.css';

type TStep = 'create-invoice' | 'wait' | 'invoice' | 'success';

export function Receive() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { defaultCurrency } = useContext(RatesContext);
  const mounted = useMountedRef();
  const amountRequestId = useRef(0);
  const [inputSatsText, setInputSatsText] = useState<string>('');
  const [inputFiatText, setInputFiatText] = useState<string>('');
  const [invoiceAmount, setInvoiceAmount] = useState<TBtcSatAmount>();
  const [description, setDescription] = useState<string>('');
  const [receivePaymentResponse, setReceivePaymentResponse] = useState<TReceivePaymentResponse>();
  const [receiveError, setReceiveError] = useState<string>();
  const [step, setStep] = useState<TStep>('create-invoice');
  const [payments, setPayments] = useState<TLightningPayment[]>();
  const invoiceAmountSat = invoiceAmount ? Number(invoiceAmount.amount) : undefined;

  const newInvoice = useCallback(() => {
    setInputSatsText('');
    setInputFiatText('');
    setInvoiceAmount(undefined);
    setDescription('');
    setReceivePaymentResponse(undefined);
    setReceiveError(undefined);
    setStep('create-invoice');
    setPayments(undefined);
  }, []);

  const back = useCallback(() => {
    switch (step) {
    case 'create-invoice':
      navigate('/lightning');
      break;
    case 'invoice':
    case 'success':
      setStep('create-invoice');
      setReceiveError(undefined);
      if (step === 'success') {
        setInputSatsText('');
        setInputFiatText('');
      }
      break;
    }
  }, [step, navigate]);

  const handleSatsAmountChange = useCallback(async (satsText: string) => {
    const requestId = ++amountRequestId.current;
    setInputSatsText(satsText);

    if (!satsText) {
      setInvoiceAmount(undefined);
      setInputFiatText('');
      return;
    }

    const response = await getBtcSatAmount({ source: 'sat', amount: satsText });
    if (!mounted.current || requestId !== amountRequestId.current) {
      return;
    }
    if (!response.success) {
      console.error('Failed to convert sats amount:', response.errorMessage);
      setInvoiceAmount(undefined);
      setInputFiatText('');
      return;
    }

    setInvoiceAmount(response.amount);
    setInputFiatText(response.amount.unformattedConversions?.[defaultCurrency] ?? '');
  }, [defaultCurrency, mounted]);

  const handleFiatAmountChange = useCallback(async (fiatText: string) => {
    const requestId = ++amountRequestId.current;
    setInputFiatText(fiatText);

    if (!fiatText) {
      setInvoiceAmount(undefined);
      setInputSatsText('');
      return;
    }

    const response = await getBtcSatAmount({ source: 'fiat', amount: fiatText });
    if (!mounted.current || requestId !== amountRequestId.current) {
      return;
    }
    if (!response.success) {
      console.error('Failed to convert fiat amount:', response.errorMessage);
      setInvoiceAmount(undefined);
      setInputSatsText('');
      return;
    }

    setInvoiceAmount(response.amount);
    setInputSatsText(response.amount.amount);
  }, [mounted]);

  const onDescriptionChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    setDescription(target.value);
  }, []);

  const onPaymentsChange = useCallback(() => {
    getListPayments().then((payments) => setPayments(payments));
  }, []);

  useEffect(() => {
    const subscriptions = [subscribeListPayments(onPaymentsChange)];
    return () => unsubscribe(subscriptions);
  }, [onPaymentsChange]);

  useEffect(() => {
    if (payments && receivePaymentResponse && step === 'invoice') {
      const payment = payments.find((payment) => payment.type === 'receive' && payment.invoice === receivePaymentResponse.invoice);
      if (payment?.status === 'complete') {
        setStep('success');
      }
    }
  }, [payments, receivePaymentResponse, step]);

  const receivePayment = useCallback(async () => {
    setReceiveError(undefined);
    if (invoiceAmountSat === undefined || invoiceAmountSat <= 0) {
      setReceiveError(t('send.error.invalidAmount'));
      return;
    }
    setStep('wait');
    try {
      const receivePaymentResponse = await getReceivePayment({
        amountSat: invoiceAmountSat,
        description,
      });
      setReceivePaymentResponse(receivePaymentResponse);
      setStep('invoice');
    } catch (e) {
      setStep('create-invoice');
      if (e instanceof TSdkError) {
        setReceiveError(e.message);
      } else {
        setReceiveError(String(e));
      }
    }
  }, [description, invoiceAmountSat, t]);

  const renderSteps = () => {
    switch (step) {
    case 'create-invoice':
      return (
        <View fitContent minHeight="100%">
          <ViewContent>
            <Grid col="1">
              <Column>
                <h1 className={styles.title}>{t('lightning.receive.subtitle')}</h1>
                <NumberInput
                  step="1"
                  min="0"
                  label={t('lightning.receive.amountSats.label')}
                  placeholder={t('lightning.receive.amountSats.placeholder')}
                  id="amountSatsInput"
                  onChange={handleSatsAmountChange}
                  value={inputSatsText}
                  autoFocus
                />
                <NumberInput
                  step="any"
                  min="0"
                  label={defaultCurrency}
                  placeholder={t('lightning.receive.amountSats.placeholder')}
                  id="amountFiatInput"
                  onChange={handleFiatAmountChange}
                  value={inputFiatText}
                />
                <Input
                  label={t('lightning.receive.description.label')}
                  placeholder={t('lightning.receive.description.placeholder')}
                  id="descriptionInput"
                  onInput={onDescriptionChange}
                  value={description}
                  labelSection={<OptionalLabel>{t('lightning.receive.description.optional')}</OptionalLabel>}
                />
              </Column>
            </Grid>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={receivePayment} disabled={invoiceAmountSat === undefined || invoiceAmountSat <= 0}>
              {t('lightning.receive.invoice.create')}
            </Button>
            <Button secondary onClick={back}>
              {t('button.back')}
            </Button>
          </ViewButtons>
        </View>
      );
    case 'wait':
      return <Spinner text={t('lightning.receive.invoice.creating')} />;
    case 'invoice':
      return (
        <View fitContent minHeight="100%">
          <ViewContent textAlign="center">
            <Grid col="1">
              <Column>
                <h1 className={styles.title}>{t('lightning.receive.invoice.title')}</h1>
                <QRCode data={receivePaymentResponse?.invoice} />
                <div className={styles.invoiceSummary}>
                  {inputSatsText} sats ({invoiceAmount && (<AmountWithUnit alwaysShowAmounts amount={invoiceAmount} convertToFiat/>)})
                  <br />
                  {description}
                </div>
                <Button transparent onClick={back}>
                  <EditActive className={styles.btnIcon} />
                  {t('lightning.receive.invoice.edit')}
                </Button>
                <CopyButton data={receivePaymentResponse?.invoice} successText={t('lightning.receive.invoice.copied')}>
                  {t('button.copy')}
                </CopyButton>
              </Column>
            </Grid>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate('/lightning')}>
              {t('button.done')}
            </Button>
            <Button secondary onClick={newInvoice}>
              {t('lightning.receive.invoice.newInvoice')}
            </Button>
          </ViewButtons>
        </View>
      );
    case 'success':
      return (
        <View fitContent textCenter verticallyCentered>
          <ViewContent withIcon="success">
            <p>{t('lightning.receive.success.message')}</p>
            <span>{inputSatsText} sats ({invoiceAmount && (<AmountWithUnit alwaysShowAmounts amount={invoiceAmount} convertToFiat/>)})</span>
            <br />
            {description && ` / ${description}`}
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate('/lightning')}>
              {t('button.done')}
            </Button>
            <Button secondary onClick={newInvoice}>
              {t('lightning.receive.invoice.newInvoice')}
            </Button>
          </ViewButtons>
        </View>
      );
    }
  };

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Status dismissibleKey="" type="warning" hidden={!receiveError}>
            {receiveError}
          </Status>
          <Header title={<h2>{t('lightning.receive.title')}</h2>} />
          {renderSteps()}
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
}

type TCopyButtonProps = {
  data?: string;
  successText?: string;
  children: string;
};

const CopyButton = ({ data, successText, children }: TCopyButtonProps) => {
  const [state, setState] = useState('ready');
  const [buttonText, setButtonText] = useState(children);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const copy = () => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
    if (document.execCommand('copy')) {
      setState('success');
      successText && setButtonText(successText);
    }
  };

  return (
    <Button transparent onClick={copy} disabled={!data}>
      <textarea className={styles.hiddenInput} ref={textareaRef} value={data} readOnly></textarea>
      {state === 'success' ? <Checked className={styles.btnIcon} /> : <Copy className={styles.btnIcon} />}
      {buttonText}
    </Button>
  );
};
