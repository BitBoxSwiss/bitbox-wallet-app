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

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '../../../api/account';
import { Column, Grid, GuideWrapper, GuidedContent, Header, Main } from '../../../components/layout';
import { View, ViewButtons, ViewContent } from '../../../components/view/view';
import { Button } from '../../../components/forms';
import { InputType, InputTypeVariant, SdkError, getParseInput, postSendPayment } from '../../../api/lightning';
import { SimpleMarkup } from '../../../utils/markup';
import { route } from '../../../utils/route';
import { toSat } from '../../../utils/conversion';
import { Amount } from '../../../components/amount/amount';
import { FiatConversion } from '../../../components/rates/rates';
import { Status } from '../../../components/status/status';
import { ScanQRVideo } from '../../account/send/components/inputs/scan-qr-video';
import { Spinner } from '../../../components/spinner/Spinner';
import styles from './send.module.css';

type TStep = 'select-invoice' | 'confirm' | 'sending' | 'success';

const SendingSpinner = () => {
  const { t } = useTranslation();
  // Show dummy connecting-to-server message first
  const [message, setStep] = useState<string>(t('lightning.send.sending.connecting'));

  setTimeout(() => {
    setStep(t('lightning.send.sending.message'));
  }, 4000);

  return <Spinner text={message} guideExists={false} />;
};

export function Send() {
  const { t } = useTranslation();
  const [parsedInput, setParsedInput] = useState<InputType>();
  const [rawInputError, setRawInputError] = useState<string>();
  const [sendError, setSendError] = useState<string>();
  const [step, setStep] = useState<TStep>('select-invoice');

  const back = () => {
    switch (step) {
    case 'select-invoice':
      route('/lightning');
      break;
    case 'confirm':
    case 'success':
      setStep('select-invoice');
      setSendError(undefined);
      setParsedInput(undefined);
      break;
    }
  };

  const parseInput = useCallback(async (rawInput: string) => {
    setRawInputError(undefined);
    try {
      const result = await getParseInput({ s: rawInput });
      switch (result.type) {
      case InputTypeVariant.BOLT11:
        setParsedInput(result);
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
    }
  }, []);

  const sendPayment = async () => {
    setStep('sending');
    setSendError(undefined);
    try {
      switch (parsedInput?.type) {
      case InputTypeVariant.BOLT11:
        await postSendPayment({ bolt11: parsedInput.invoice.bolt11 });
        setStep('success');
        setTimeout(() => route('/lightning'), 5000);
        break;
      }
    } catch (e) {
      setStep('select-invoice');
      if (e instanceof SdkError) {
        setSendError(e.message);
      } else {
        setSendError(String(e));
      }
    }
  };

  const renderInputTypes = () => {
    switch (parsedInput!.type) {
    case InputTypeVariant.BOLT11:
      const balance: accountApi.IBalance = {
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
          <div className={styles.info}>
            <h2 className={styles.label}>{t('lightning.send.confirm.amount')}</h2>
            <Amount amount={balance.available.amount} unit={balance.available.unit} removeBtcTrailingZeroes />/{' '}
            <FiatConversion amount={balance.available} noBtcZeroes />
          </div>
          {parsedInput?.invoice.description && (
            <div className={styles.info}>
              <h2 className={styles.label}>{t('lightning.send.confirm.memo')}</h2>
              {parsedInput?.invoice.description}
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
          <ViewContent textAlign="center">
            <Grid col="1">
              <Column>
                {/* this flickers quickly, as there is 'SdkError: Generic: Breez SDK error: Unrecognized input type' when logging rawInputError */}
                {rawInputError && <Status type="warning">{rawInputError}</Status>}
                <ScanQRVideo onResult={parseInput} />
                {/* Note: unfortunatelly we probably can't read from HTML5 clipboard api directly in Qt/Andoird WebView */}
                <Button transparent onClick={() => console.log('TODO: implement paste')}>
                  {t('lightning.send.rawInput.label')}
                </Button>
              </Column>
            </Grid>
          </ViewContent>
          <ViewButtons reverseRow>
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
        <View fitContent minHeight="100%">
          <ViewContent>
            <Grid col="1">{renderInputTypes()}</Grid>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={sendPayment}>
              {t('button.send')}
            </Button>
            <Button secondary onClick={back}>
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
