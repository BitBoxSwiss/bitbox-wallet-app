// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useCallback, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Column, Grid, GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { Button, Input, NumberInput, OptionalLabel } from '@/components/forms';
import {
  TReceivePaymentResponse,
  getLightningBalance,
  getLightningAddress,
  getReceivePayment,
  subscribeLightningAddress,
} from '@/api/lightning';
import { getBtcSatAmount, type TBtcSatAmount } from '@/api/coins';
import { Status } from '@/components/status/status';
import { QRCode } from '@/components/qrcode/qrcode';
import { Spinner } from '@/components/spinner/Spinner';
import { Checked, Copy, CreateInvoice } from '@/components/icon';
import { FormattedAmount } from '@/components/amount/amount';
import { AmountWithUnit } from '@/components/amount/amount-with-unit';
import { useNavigate } from 'react-router-dom';
import { RatesContext } from '@/contexts/RatesContext';
import { useLoad, useSync } from '@/hooks/api';
import { useMountedRef } from '@/hooks/mount';
import { toLightningErrorMessage } from '@/api/lightning-errors';
import { type TReceiveStep, useReceivePaymentSuccess } from './use-receive-payment-success';
import styles from './receive.module.css';

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
  const [step, setStep] = useState<TReceiveStep>('address');
  const [balanceLoadAttempt, setBalanceLoadAttempt] = useState(0);
  const lightningBalance = useLoad(getLightningBalance, [balanceLoadAttempt]);
  const lightningAddress = useSync(getLightningAddress, subscribeLightningAddress);
  const invoiceAmountSat = invoiceAmount ? Number(invoiceAmount.amount) : undefined;
  const satsBalance = lightningBalance?.available.unit === 'sat'
    ? lightningBalance.available.amount
    : lightningBalance?.available.unformattedConversions?.sat;
  const hasLightningBalance = lightningBalance !== undefined;
  const onReceivePaymentSuccess = useCallback(() => {
    setBalanceLoadAttempt(attempt => attempt + 1);
    setStep('success');
  }, []);
  const { receivedPayment, resetReceivedPayment } = useReceivePaymentSuccess({
    onSuccess: onReceivePaymentSuccess,
    receivePaymentResponse,
    step,
  });

  const newInvoice = useCallback(() => {
    setInputSatsText('');
    setInputFiatText('');
    setInvoiceAmount(undefined);
    setDescription('');
    setReceivePaymentResponse(undefined);
    setReceiveError(undefined);
    resetReceivedPayment();
    setStep('create-invoice');
  }, [resetReceivedPayment]);

  const cancelInvoice = useCallback(() => {
    setInputSatsText('');
    setInputFiatText('');
    setInvoiceAmount(undefined);
    setDescription('');
    setReceivePaymentResponse(undefined);
    setReceiveError(undefined);
    resetReceivedPayment();
    setStep('address');
  }, [resetReceivedPayment]);

  const back = useCallback(() => {
    switch (step) {
    case 'address':
      navigate('/lightning');
      break;
    case 'create-invoice':
      setStep('address');
      setReceiveError(undefined);
      break;
    case 'invoice':
    case 'success':
      setStep('create-invoice');
      setReceiveError(undefined);
      if (step === 'success') {
        setInputSatsText('');
        setInputFiatText('');
        resetReceivedPayment();
      }
      break;
    }
  }, [step, navigate, resetReceivedPayment]);

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
      setReceiveError(toLightningErrorMessage(t, e));
    }
  }, [description, invoiceAmountSat, t]);

  const successDescription = receivedPayment?.description || description;

  const renderSteps = () => {
    switch (step) {
    case 'address':
      if (lightningAddress === undefined) {
        return <Spinner text={t('loading')} />;
      }
      return (
        <View fitContent minHeight="100%">
          <ViewContent textAlign="center">
            <div className={styles.addressContent}>
              <p className={styles.qrInstruction}>{t('lightning.receive.address.scanQRCode')}</p>
              <div className={styles.addressQRCode}>
                <QRCode data={lightningAddress || undefined} size={168} tapToCopy={false} />
              </div>
              {lightningAddress && (
                <>
                  <p className={styles.addressValue}>{lightningAddress}</p>
                  <CopyButton
                    className={styles.addressAction}
                    contentClassName={styles.addressActionContent}
                    data={lightningAddress}
                    iconClassName={styles.addressActionIcon}
                    successText={t('receive.qrCodeCopiedMessage')}>
                    {t('button.copy')}
                  </CopyButton>
                </>
              )}
              <Button transparent className={styles.addressAction} onClick={newInvoice}>
                <span className={styles.addressActionContent}>
                  <CreateInvoice className={styles.createInvoiceIcon} height={18} width={18} />
                  {t('lightning.receive.invoice.create')}
                </span>
              </Button>
            </div>
          </ViewContent>
          <ViewButtons>
            <Button secondary onClick={back}>
              {t('button.back')}
            </Button>
          </ViewButtons>
        </View>
      );
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
                  labelSection={hasLightningBalance ? (
                    <span className={styles.balanceLabel}>
                      {t('accountSummary.balance')}: <FormattedAmount amount={satsBalance || '0'} unit="sat" /> sats
                    </span>
                  ) : undefined}
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
            <div className={styles.invoiceContent}>
              <p className={styles.qrInstruction}>{t('lightning.receive.invoice.title')}</p>
              <div className={styles.invoiceQRCode}>
                <QRCode data={receivePaymentResponse?.invoice} size={216} tapToCopy={false} />
              </div>
              <p className={styles.invoiceAmount}>
                <span>{inputSatsText} sats</span>
                {invoiceAmount && (
                  <>
                    {' '}
                    <AmountWithUnit
                      alwaysShowAmounts
                      amount={invoiceAmount}
                      amountClassName={styles.invoiceFiatAmount}
                      convertToFiat
                      unitClassName={styles.invoiceFiatAmount}
                    />
                  </>
                )}
              </p>
              {description && (
                <p className={styles.invoiceDescription}>{description}</p>
              )}
              <CopyButton
                className={styles.invoiceCopyButton}
                contentClassName={styles.addressActionContent}
                data={receivePaymentResponse?.invoice}
                iconClassName={styles.addressActionIcon}
                successText={t('lightning.receive.invoice.copied')}>
                {t('button.copy')}
              </CopyButton>
            </div>
          </ViewContent>
          <ViewButtons>
            <Button secondary onClick={cancelInvoice}>
              {t('dialog.cancel')}
            </Button>
          </ViewButtons>
        </View>
      );
    case 'success':
      return (
        <View fitContent textCenter verticallyCentered>
          <ViewContent withIcon="success">
            <p>{t('lightning.receive.success.message')}</p>
            <span className={styles.successAmount}>
              {receivedPayment ? (
                <>
                  <AmountWithUnit alwaysShowAmounts amount={receivedPayment.amountAtTime} />
                  {' ('}
                  <AmountWithUnit alwaysShowAmounts amount={receivedPayment.amountAtTime} convertToFiat />
                  {')'}
                </>
              ) : (
                <>
                  {inputSatsText} sats
                  {invoiceAmount && (
                    <> (<AmountWithUnit alwaysShowAmounts amount={invoiceAmount} convertToFiat />)</>
                  )}
                </>
              )}
            </span>
            {successDescription && (
              <p className={styles.successNote}>{successDescription}</p>
            )}
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
  className?: string;
  contentClassName?: string;
  data?: string;
  iconClassName?: string;
  successText?: string;
  children: string;
};

const CopyButton = ({
  className,
  contentClassName,
  data,
  iconClassName,
  successText,
  children,
}: TCopyButtonProps) => {
  const [state, setState] = useState('ready');
  const [buttonText, setButtonText] = useState(children);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iconProps = iconClassName
    ? { className: iconClassName, height: 24, width: 24 }
    : { className: styles.btnIcon };

  const copy = () => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
    if (document.execCommand('copy')) {
      setState('success');
      successText && setButtonText(successText);
    }
  };

  return (
    <Button transparent className={className} onClick={copy} disabled={!data}>
      <textarea aria-hidden="true" className={styles.hiddenInput} ref={textareaRef} tabIndex={-1} value={data} readOnly></textarea>
      <span className={contentClassName}>
        {state === 'success' ? <Checked {...iconProps} /> : <Copy {...iconProps} />}
        {buttonText}
      </span>
    </Button>
  );
};
