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

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '../../../api/account';
import { Column, Grid, GuideWrapper, GuidedContent, Header, Main } from '../../../components/layout';
import { View, ViewButtons, ViewContent } from '../../../components/view/view';
import { Button } from '../../../components/forms';
import { InputType, InputTypeVariant, SdkError, getParseInput, postSendPayment } from '../../../api/lightning';
import styles from './send.module.css';
import { SimpleMarkup } from '../../../utils/markup';
import { route } from '../../../utils/route';
import { toSat } from '../../../utils/conversion';
import { InlineBalance } from '../../../components/balance/balance';
import { IBalance } from '../../../api/account';
import { Status } from '../../../components/status/status';
import { ScanQRVideo } from '../../account/send/components/inputs/scan-qr-video';

type TStep = 'select-invoice' | 'confirm' | 'success';

type Props = {
  accounts: accountApi.IAccount[];
  code: string;
};

export function Send({ accounts, code }: Props) {
  const { t } = useTranslation();
  const [activeScanQr, setActiveScanQr] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [parsedInput, setParsedInput] = useState<InputType>();
  const [rawInput, setRawInput] = useState<string>('');
  const [rawInputError, setRawInputError] = useState<string>();
  const [sendError, setSendError] = useState<string>();
  const [step, setStep] = useState<TStep>('select-invoice');

  const back = () => {
    switch (step) {
    case 'select-invoice':
      route(`/account/${code}/lightning`);
      break;
    case 'confirm':
    case 'success':
      setStep('select-invoice');
      setSendError(undefined);
      setParsedInput(undefined);
      setRawInput('');
      break;
    }
  };

  const onInvoice = (invoice: string) => {
    setRawInput(invoice);
    parseInput();
  };

  const parseInput = useCallback(async () => {
    setRawInputError(undefined);
    setBusy(true);
    try {
      const result = await getParseInput(code, { s: rawInput });
      switch (result.type) {
      case InputTypeVariant.BOLT11:
        setParsedInput(result);
        setActiveScanQr(false);
        setStep('confirm');
        break;
      default:
        setRawInputError('Invalid input');
      }
    } catch (e) {
      if (e instanceof SdkError) {
        setRawInputError(e.message);
      } else {
        setRawInputError(String(e));
      }
    } finally {
      setBusy(false);
    }
  }, [code, rawInput]);

  const sendPayment = async () => {
    setSendError(undefined);
    setBusy(true);
    try {
      switch (parsedInput?.type) {
      case InputTypeVariant.BOLT11:
        await postSendPayment(code, { bolt11: parsedInput.invoice.bolt11 });
        setStep('success');
        setTimeout(() => route(`/account/${code}/lightning`), 5000);
        break;
      }
    } catch (e) {
      if (e instanceof SdkError) {
        setSendError(e.message);
      } else {
        setSendError(String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const renderInputTypes = () => {
    switch (parsedInput!.type) {
    case InputTypeVariant.BOLT11:
      const balance: IBalance = {
        hasAvailable: true,
        available: {
          amount: `${toSat(parsedInput?.invoice.amountMsat || 0)}`,
          unit: 'sat'
        },
        hasIncoming: false,
        incoming: {
          amount: '0',
          unit: 'sat'
        }
      };
      return (
        <Column>
          <h1 className={styles.title}>{t('lightning.send.confirm.title')}</h1>
          <div className="info">
            <h2 className={styles.label}>{t('lightning.send.confirm.amount')}</h2>
            <p>
              <InlineBalance balance={balance} />
            </p>
          </div>
          {parsedInput?.invoice.description && (
            <div className="info">
              <h2 className={styles.label}>{t('lightning.send.confirm.memo')}</h2>
              <p>{parsedInput?.invoice.description}</p>
            </div>
          )}
        </Column>
      );
    }
  };

  const renderSteps = () => {
    switch (step) {
    case 'select-invoice':
      return (
        <View fitContent>
          <ViewContent>
            <Grid col="1">
              <Column>
                {/* this flickers quickly, as there is 'SdkError: Generic: Breez SDK error: Unrecognized input type' when logging rawInputError */}
                { rawInputError && (
                  <Status type="warning">{rawInputError}</Status>
                )}
                <ScanQRVideo onResult={onInvoice} />
                {/* Note: unfortunatelly we probably can't read from HTML5 clipboard api directly in Qt/Andoird WebView */}
                {/* <Button transparent onClick={() => console.log('TODO: paste')}>
                  {t('lightning.send.rawInput.label')}
                </Button> */}
              </Column>
            </Grid>
          </ViewContent>
          <ViewButtons>
            {/* <Button primary onClick={parseInput} disabled={busy}>
              {t('button.send')}
            </Button> */}
            <Button secondary onClick={back}>
              {t('button.back')}
            </Button>
          </ViewButtons>
        </View>
      );
    case 'confirm':
      return (
        <View
          fitContent
          minHeight="100%">
          <ViewContent>
            <Grid col="1">
              {renderInputTypes()}
            </Grid>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={sendPayment} disabled={busy}>
              {t('button.send')}
            </Button>
            <Button secondary onClick={back} disabled={busy}>
              {t('button.back')}
            </Button>
          </ViewButtons>
        </View>
      );
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

  useEffect(() => {
    if (activeScanQr && rawInput) {
      parseInput();
    }
  }, [activeScanQr, parseInput, rawInput]);

  const account = accounts && accounts.find((acct) => acct.code === code);
  if (!account) {
    return null;
  }

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Status type="warning" hidden={!sendError}>
            {sendError}
          </Status>
          <Header title={<h2>{t('lightning.send.title')}</h2>} />
          {renderSteps()}
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
}
