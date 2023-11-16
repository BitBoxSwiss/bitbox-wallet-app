/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
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

import { Column, ColumnButtons, Grid, GuideWrapper, GuidedContent, Header, Main } from '../../../components/layout';
import { useTranslation } from 'react-i18next';
import { View, ViewButtons, ViewContent } from '../../../components/view/view';
import { Button, Input, OptionalLabel } from '../../../components/forms';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
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
import styles from './receive.module.css';

type TStep = 'select-amount' | 'wait' | 'invoice' | 'success';

export function Receive() {
  const { t } = useTranslation();
  const [amountSats, setAmountSats] = useState<number>(0);
  const [amountSatsText, setAmountSatsText] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [openChannelFeeResponse, setOpenChannelFeeResponse] = useState<OpenChannelFeeResponse>();
  const [receivePaymentResponse, setReceivePaymentResponse] = useState<ReceivePaymentResponse>();
  const [receiveError, setReceiveError] = useState<string>();
  const [showOpenChannelWarning, setShowOpenChannelWarning] = useState<boolean>(false);
  const [step, setStep] = useState<TStep>('select-amount');
  const [payments, setPayments] = useState<Payment[]>();

  const back = () => {
    switch (step) {
    case 'select-amount':
      route('/lightning');
      break;
    case 'invoice':
    case 'success':
      setStep('select-amount');
      setReceiveError(undefined);
      if (step === 'success') {
        setAmountSatsText('');
      }
      break;
    }
  };

  const onAmountSatsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    setAmountSatsText(target.value);
  };

  const onDescriptionChange = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    setDescription(target.value);
  };

  const onPaymentsChange = useCallback(() => {
    getListPayments({ filters: [PaymentTypeFilter.RECEIVED], limit: 5 }).then((payments) => setPayments(payments));
  }, []);

  useEffect(() => {
    const subscriptions = [subscribeListPayments(onPaymentsChange)];
    return () => unsubscribe(subscriptions);
  }, [onPaymentsChange]);

  useEffect(() => {
    setAmountSats(+amountSatsText);
  }, [amountSatsText]);

  useEffect(() => {
    (async () => {
      if (amountSats > 0) {
        const openChannelFeeResponse = await getOpenChannelFee({ amountMsat: toMsat(amountSats) });
        setOpenChannelFeeResponse(openChannelFeeResponse);
        setShowOpenChannelWarning(openChannelFeeResponse.feeMsat > 0);
      }
    })();
  }, [amountSats]);

  useEffect(() => {
    if (payments && receivePaymentResponse && step === 'invoice') {
      const payment = payments.find((payment) => payment.id === receivePaymentResponse.lnInvoice.paymentHash);
      if (payment?.status === PaymentStatus.COMPLETE) {
        setStep('success');
        setTimeout(() => route('/lightning'), 5000);
      }
    }
  }, [payments, receivePaymentResponse, step]);

  const receivePayment = async () => {
    setReceiveError(undefined);
    setStep('wait');
    try {
      const receivePaymentResponse = await postReceivePayment({
        amountMsat: toMsat(amountSats),
        description,
        openingFeeParams: openChannelFeeResponse?.usedFeeParams
      });
      setReceivePaymentResponse(receivePaymentResponse);
      setStep('invoice');
    } catch (e) {
      if (e instanceof SdkError) {
        setReceiveError(e.message);
      } else {
        setReceiveError(String(e));
      }
    }
  };

  const renderSteps = () => {
    switch (step) {
    case 'select-amount':
      return (
        <View>
          <ViewContent>
            <Grid col="1">
              <Column>
                <h1 className={styles.title}>{t('lightning.receive.subtitle')}</h1>
                <Input
                  type="number"
                  min="0"
                  label={t('lightning.receive.amountSats.label')}
                  placeholder={t('lightning.receive.amountSats.placeholder')}
                  id="amountSatsInput"
                  onInput={onAmountSatsChange}
                  value={amountSatsText}
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
            <Button primary onClick={receivePayment} disabled={amountSats === 0}>
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
                <div>
                  <QRCode data={receivePaymentResponse?.lnInvoice.bolt11} />
                </div>
                <div className={styles.invoiceSummary}>
                  {amountSatsText} sats (--- EUR)
                  {description && ` / ${description}`}
                </div>
                <ColumnButtons>
                  <CopyButton data={receivePaymentResponse?.lnInvoice.bolt11} successText={t('lightning.receive.invoice.copied')}>
                    {t('button.copy')}
                  </CopyButton>
                  <Button transparent onClick={back}>
                    <EditActive className={styles.btnIcon} />
                    {t('lightning.receive.invoice.edit')}
                  </Button>
                </ColumnButtons>
              </Column>
            </Grid>
          </ViewContent>
          <ViewButtons>
            <Button secondary onClick={() => route('/lightning')}>
              {t('button.done')}
            </Button>
          </ViewButtons>
        </View>
      );
    case 'success':
      return (
        <View fitContent textCenter verticallyCentered>
          <ViewContent withIcon="success">
            <p>{t('lightning.receive.success.message')}</p>
            {amountSatsText} sats (--- EUR)
            <br />
            {description && ` / ${description}`}
          </ViewContent>
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

  const copy = () => {
    try {
      if (data) {
        navigator.clipboard.writeText(data).then(() => {
          setState('success');
          successText && setButtonText(successText);
        });
      }
    } catch (error) {
      setState('ready');
      if (error instanceof Error) {
        setButtonText(error.message);
      }
      setButtonText(`${error}`);
    }
  };

  return (
    <Button transparent onClick={copy} disabled={!data}>
      {state === 'success' ? <Checked className={styles.btnIcon} /> : <Copy className={styles.btnIcon} />}
      {buttonText}
    </Button>
  );
};
