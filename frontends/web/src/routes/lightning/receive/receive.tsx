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

import * as accountApi from '../../../api/account';
import { Column, ColumnButtons, Grid, GuideWrapper, GuidedContent, Header, Main } from '../../../components/layout';
import { useTranslation } from 'react-i18next';
import { View, ViewContent } from '../../../components/view/view';
import { Button, Input } from '../../../components/forms';
import { ChangeEvent, useEffect, useState } from 'react';
import { OpenChannelFeeResponse, PaymentStatus, PaymentTypeFilter, ReceivePaymentResponse, SdkError, postListPayments, postOpenChannelFee, postReceivePayment, subscribeListPayments } from '../../../api/lightning';
import styles from './receive.module.css';
import { SimpleMarkup } from '../../../utils/markup';
import { Check } from '../../../components/icon';
import { route } from '../../../utils/route';
import { toMsat, toSat } from '../../../utils/conversion';
import { Status } from '../../../components/status/status';
import { QRCode } from '../../../components/qrcode/qrcode';
import { useSync } from '../../../hooks/api';

type TStep = 'select-amount' | 'wait' | 'success';

type Props = {
  accounts: accountApi.IAccount[];
  code: string;
};

export function Receive({ accounts, code }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<boolean>(false);
  const [amountSats, setAmountSats] = useState<number>(0);
  const [amountSatsText, setAmountSatsText] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [openChannelFeeResponse, setOpenChannelFeeResponse] = useState<OpenChannelFeeResponse>();
  const [receivePaymentResponse, setReceivePaymentResponse] = useState<ReceivePaymentResponse>();
  const [receiveError, setReceiveError] = useState<string>();
  const [showOpenChannelWarning, setShowOpenChannelWarning] = useState<boolean>(false);
  const [step, setStep] = useState<TStep>('select-amount');
  const payments = useSync(() => postListPayments(code, { filter: PaymentTypeFilter.RECEIVED }), subscribeListPayments(code));

  const back = () => {
    switch (step) {
    case 'select-amount':
      route(`/account/${code}/lightning`);
      break;
    case 'wait':
    case 'success':
      setStep('select-amount');
      setReceiveError(undefined);
      setAmountSatsText('');
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

  useEffect(() => {
    setAmountSats(+amountSatsText);
  }, [amountSatsText]);

  useEffect(() => {
    (async () => {
      if (amountSats > 0) {
        const openChannelFeeResponse = await postOpenChannelFee(code, { amountMsat: toMsat(amountSats) });
        setOpenChannelFeeResponse(openChannelFeeResponse);
        setShowOpenChannelWarning(openChannelFeeResponse.feeMsat > 0);
      }
    })();
  }, [amountSats, code]);

  useEffect(() => {
    if (payments && receivePaymentResponse && step === 'wait') {
      const payment = payments.find((payment) => payment.id === receivePaymentResponse.lnInvoice.paymentHash);
      if (payment?.status === PaymentStatus.COMPLETE) {
        setStep('success');
        setTimeout(() => route(`/account/${code}/lightning`), 5000);
      }
    }
  }, [code, payments, receivePaymentResponse, step]);

  const receivePayment = async () => {
    setReceiveError(undefined);
    setBusy(true);
    try {
      const receivePaymentResponse = await postReceivePayment(code, {
        amountSats,
        description,
        openingFeeParams: openChannelFeeResponse?.usedFeeParams
      });
      setReceivePaymentResponse(receivePaymentResponse);
      setStep('wait');
    } catch (e) {
      if (e instanceof SdkError) {
        console.log(e);
        setReceiveError(e.message);
      } else {
        setReceiveError(String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const renderSteps = () => {
    switch (step) {
    case 'select-amount':
      return (
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
              value={amountSats}
              autoFocus
            />
            <Input
              label={t('lightning.receive.description.label')}
              placeholder={t('lightning.receive.description.placeholder')}
              id="descriptionInput"
              onInput={onDescriptionChange}
              value={description}
              labelSection={(<span>{t('note.input.description')}</span>)}
            />
            <Status hidden={!showOpenChannelWarning} type="info">
              {t('lightning.receive.openChannelWarning', { feeSat: toSat(openChannelFeeResponse?.feeMsat!) })}
            </Status>
            <ColumnButtons className="m-top-default m-bottom-xlarge" inline>
              <Button primary onClick={receivePayment} disabled={busy || amountSats === 0}>
                {t('button.receive')}
              </Button>
              <Button secondary onClick={back}>
                {t('button.back')}
              </Button>
            </ColumnButtons>
          </Column>
        </Grid>
      );
    case 'wait':
      return (
        <Grid col="1">
          <Column>
            <QRCode data={receivePaymentResponse?.lnInvoice.bolt11} />
          </Column>
          <Column>
            <ColumnButtons className="m-top-default m-bottom-xlarge" inline>
              <Button secondary onClick={back} disabled={busy}>
                {t('button.back')}
              </Button>
            </ColumnButtons>
          </Column>
        </Grid>
      );
    case 'success':
      return (
        <div className="text-center">
          <Check className={styles.successCheck} />
          <br />
          <SimpleMarkup className={styles.successMessage} markup={t('lightning.receive.success.message')} tagName="p" />
        </div>
      );
    }
  };

  const account = accounts && accounts.find((acct) => acct.code === code);
  if (!account) {
    return null;
  }

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Status type="warning" hidden={!receiveError}>
            {receiveError}
          </Status>
          <Header title={<h2>{t('lightning.receive.title')}</h2>} />
          <View>
            <ViewContent>
              {renderSteps()}
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
}
