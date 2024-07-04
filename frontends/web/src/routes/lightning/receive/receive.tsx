/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023-2024 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Column, Grid, GuideWrapper, GuidedContent, Header, Main } from '../../../components/layout';
import { View, ViewButtons, ViewContent } from '../../../components/view/view';
import { Button, Input, OptionalLabel } from '../../../components/forms';
import {
  OpenChannelFeeResponse,
  Payment,
  PaymentStatus,
  PaymentTypeFilter,
  ReceivePaymentResponse,
  SdkError,
  getListPayments,
  getOpenChannelFee,
  postReceivePayment,
  subscribeListPayments
} from '../../../api/lightning';
import { route } from '../../../utils/route';
import { toMsat, toSat } from '../../../utils/conversion';
import { Status } from '../../../components/status/status';
import { QRCode } from '../../../components/qrcode/qrcode';
import { unsubscribe } from '../../../utils/subscriptions';
import { Spinner } from '../../../components/spinner/Spinner';
import { Checked, Copy, EditActive } from '../../../components/icon';
import { FiatConversion } from '../../../components/rates/rates';
import { getBtcSatsAmount } from '../../../api/coins';
import { IAmount } from '../../../api/account';
import styles from './receive.module.css';

type TStep = 'create-invoice' | 'wait' | 'invoice' | 'success';

export function Receive() {
  const { t } = useTranslation();
  const [inputSatsText, setInputSatsText] = useState<string>('');
  const [invoiceAmount, setInvoiceAmount] = useState<IAmount>();
  const [description, setDescription] = useState<string>('');
  const [disableConfirm, setDisableConfirm] = useState(true);
  const [openChannelFeeResponse, setOpenChannelFeeResponse] = useState<OpenChannelFeeResponse>();
  const [receivePaymentResponse, setReceivePaymentResponse] = useState<ReceivePaymentResponse>();
  const [receiveError, setReceiveError] = useState<string>();
  const [showOpenChannelWarning, setShowOpenChannelWarning] = useState<boolean>(false);
  const [step, setStep] = useState<TStep>('create-invoice');
  const [payments, setPayments] = useState<Payment[]>();

  const newInvoice = useCallback(() => {
    setInputSatsText('');
    setInvoiceAmount(undefined);
    setDescription('');
    setDisableConfirm(true);
    setReceivePaymentResponse(undefined);
    setReceiveError(undefined);
    setShowOpenChannelWarning(false);
    setStep('create-invoice');
    setPayments(undefined);
  }, []);

  const back = useCallback(() => {
    switch (step) {
    case 'create-invoice':
      route('/lightning');
      break;
    case 'invoice':
    case 'success':
      setStep('create-invoice');
      setReceiveError(undefined);
      if (step === 'success') {
        setInputSatsText('');
      }
      break;
    }
  }, [step]);

  const onAmountSatsChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    setInputSatsText(target.value);
  }, []);

  const onDescriptionChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    setDescription(target.value);
  }, []);

  const onPaymentsChange = useCallback(() => {
    getListPayments({ filters: [PaymentTypeFilter.RECEIVED], limit: 5 }).then((payments) => setPayments(payments));
  }, []);

  useEffect(() => {
    const subscriptions = [subscribeListPayments(onPaymentsChange)];
    return () => unsubscribe(subscriptions);
  }, [onPaymentsChange]);

  useEffect(() => {
    getBtcSatsAmount(inputSatsText).then(response => {
      if (response.success) {
        setInvoiceAmount(response.amount);
      }
    });

  }, [inputSatsText]);


  useEffect(() => {
    (async () => {
      const inputSats = Number(inputSatsText);
      if (inputSats > 0) {
        const openChannelFeeResponse = await getOpenChannelFee({ amountMsat: toMsat(inputSats) });
        setOpenChannelFeeResponse(openChannelFeeResponse);
        setShowOpenChannelWarning(openChannelFeeResponse.feeMsat ? openChannelFeeResponse.feeMsat > 0 : false);
        if (inputSats > toSat(openChannelFeeResponse.feeMsat || 0)) {
          setDisableConfirm(false);
          return;
        }
      }
      setDisableConfirm(true);
    })();
  }, [inputSatsText]);

  useEffect(() => {
    if (payments && receivePaymentResponse && step === 'invoice') {
      const payment = payments.find((payment) => payment.id === receivePaymentResponse.lnInvoice.paymentHash);
      if (payment?.status === PaymentStatus.COMPLETE) {
        setStep('success');
      }
    }
  }, [payments, receivePaymentResponse, step]);

  const receivePayment = useCallback(async () => {
    setReceiveError(undefined);
    setStep('wait');
    try {
      const receivePaymentResponse = await postReceivePayment({
        amountMsat: toMsat(Number(inputSatsText)),
        description,
        openingFeeParams: openChannelFeeResponse?.feeParams
      });
      setReceivePaymentResponse(receivePaymentResponse);
      setStep('invoice');
    } catch (e) {
      setStep('create-invoice');
      if (e instanceof SdkError) {
        setReceiveError(e.message);
      } else {
        setReceiveError(String(e));
      }
    }
  }, [description, inputSatsText, openChannelFeeResponse?.feeParams]);

  const renderSteps = () => {
    switch (step) {
    case 'create-invoice':
      return (
        <View fitContent minHeight="100%">
          <ViewContent>
            <Grid col="1">
              <Column>
                <h1 className={styles.title}>{t('lightning.receive.subtitle')}</h1>
                <span>{t('lightning.receive.amountSats.label')} ({<FiatConversion alwaysShowAmounts amount={invoiceAmount} noBtcZeroes />})</span>
                <Input
                  type="number"
                  min="0"
                  placeholder={t('lightning.receive.amountSats.placeholder')}
                  id="amountSatsInput"
                  onInput={onAmountSatsChange}
                  value={inputSatsText}
                  autoFocus
                />
                <Input
                  label={t('lightning.receive.description.label')}
                  placeholder={t('lightning.receive.description.placeholder')}
                  id="descriptionInput"
                  onInput={onDescriptionChange}
                  value={description}
                  labelSection={<OptionalLabel>{t('lightning.receive.description.optional')}</OptionalLabel>}
                />
                <Status hidden={!showOpenChannelWarning} type="info">
                  {t('lightning.receive.openChannelWarning', { feeSat: toSat(openChannelFeeResponse?.feeMsat!) })}
                </Status>
              </Column>
            </Grid>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={receivePayment} disabled={disableConfirm}>
              {t('lightning.receive.invoice.create')}
            </Button>
            <Button secondary onClick={back}>
              {t('button.back')}
            </Button>
          </ViewButtons>
        </View>
      );
    case 'wait':
      return <Spinner text={t('lightning.receive.invoice.creating')} guideExists={false} />;
    case 'invoice':
      return (
        <View fitContent minHeight="100%">
          <ViewContent textAlign="center">
            <Grid col="1">
              <Column>
                <h1 className={styles.title}>{t('lightning.receive.invoice.title')}</h1>
                <QRCode data={receivePaymentResponse?.lnInvoice.bolt11} />
                <div className={styles.invoiceSummary}>
                  {inputSatsText} sats (<FiatConversion alwaysShowAmounts amount={invoiceAmount} noBtcZeroes />)
                  <br />
                  {description}
                </div>
                <Button transparent onClick={back}>
                  <EditActive className={styles.btnIcon} />
                  {t('lightning.receive.invoice.edit')}
                </Button>
                <CopyButton data={receivePaymentResponse?.lnInvoice.bolt11} successText={t('lightning.receive.invoice.copied')}>
                  {t('button.copy')}
                </CopyButton>
              </Column>
            </Grid>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => route('/lightning')}>
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
            <span>{inputSatsText} sats (<FiatConversion alwaysShowAmounts amount={invoiceAmount} noBtcZeroes />)</span>
            <br />
            {description && ` / ${description}`}
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => route('/lightning')}>
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
          <Status type="warning" hidden={!receiveError}>
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
