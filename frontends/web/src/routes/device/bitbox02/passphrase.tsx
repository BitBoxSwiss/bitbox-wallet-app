/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021-2024 Shift Crypto AG
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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDeviceInfo, setMnemonicPassphraseEnabled } from '@/api/bitbox02';
import { MultilineMarkup, SimpleMarkup } from '@/utils/markup';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { Main } from '@/components/layout';
import { Button, Checkbox } from '@/components/forms';
import { alertUser } from '@/components/alert/Alert';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { PointToBitBox02 } from '@/components/icon';
import { Message } from '@/components/message/message';

// The enable wizard has five steps that can be navigated by clicking
// 'back' or 'continue'. On the last step the passphrase will be enabled.
const FINAL_INFO_STEP = 5;
const CONTENT_MIN_HEIGHT = '38em';

type TProps = {
  deviceID: string;
};

type TStatus = 'info' | 'progress' | 'success';

export const Passphrase = ({ deviceID }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<TStatus>('info');
  const [isEnabled, setIsEnabled] = useState<boolean>();

  useEffect(() => {
    getDeviceInfo(deviceID).then(result => {
      if (!result.success) {
        console.error(result.message);
        alertUser(t('genericError'));
        return;
      }
      const { mnemonicPassphraseEnabled } = result.deviceInfo;
      setIsEnabled(mnemonicPassphraseEnabled);
    }).catch(console.error);
  }, [deviceID, t]);

  const setPassphrase = async (enabled: boolean) => {
    setStatus('progress');
    try {
      const result = await setMnemonicPassphraseEnabled(deviceID, enabled);
      if (!result.success) {
        navigate(-1);
        if (result.code) {
          alertUser(t(`passphrase.error.e${result.code}`, {
            defaultValue: result.message || t('genericError'),
          }));
        }
        return null;
      }
      setIsEnabled(enabled);
      setStatus('success');
    } catch (error) {
      console.error(error);
    }
  };

  const handleAbort = () => navigate(-1);

  if (isEnabled === undefined) {
    return null;
  }

  return (
    <Main>
      {status === 'info' && (
        isEnabled ? (
          <DisableInfo
            handleAbort={handleAbort}
            setPassphrase={setPassphrase}
          />
        ) : (
          <EnableInfo
            handleAbort={handleAbort}
            setPassphrase={setPassphrase}
          />
        )
      )}
      {status === 'progress' && (
        <View
          key="progress"
          fullscreen
          minHeight={CONTENT_MIN_HEIGHT}
          textCenter
          verticallyCentered>
          <ViewHeader
            title={t(isEnabled
              ? 'passphrase.progressDisable.title'
              : 'passphrase.progressEnable.title')}>
            <SimpleMarkup
              tagName="p"
              markup={t(isEnabled
                ? 'passphrase.progressDisable.message'
                : 'passphrase.progressEnable.message')} />
          </ViewHeader>
          <ViewContent>
            <UseDisableBackButton />
            <PointToBitBox02 />
          </ViewContent>
        </View>
      )}
      {status === 'success' && (
        <View
          key="success"
          fullscreen
          verticallyCentered>
          <ViewHeader
            small
            title={t(isEnabled
              ? 'passphrase.successDisabled.title'
              : 'passphrase.successEnabled.title')} >
          </ViewHeader>
          <ViewContent>
            <MultilineMarkup tagName="p" markup={t(isEnabled
              ? 'passphrase.successDisabled.message'
              : 'passphrase.successEnabled.message')} />
            {isEnabled && (
              <ul style={{ paddingLeft: 'var(--space-default)' }}>
                <SimpleMarkup key="tip-1" tagName="li" markup={t('passphrase.successEnabled.tipsList.0')} />
                <SimpleMarkup key="tip-2" tagName="li" markup={t('passphrase.successEnabled.tipsList.1')} />
              </ul>
            )}
            <SimpleMarkup tagName="p" markup={t(
              isEnabled
                ? 'passphrase.successDisabled.messageEnd'
                : 'passphrase.successEnabled.messageEnd')} />
          </ViewContent>
        </View>
      )}
    </Main>
  );
};

type TInfoProps = {
  handleAbort: () => void;
  setPassphrase: (enabled: boolean) => void;
};

const EnableInfo = ({ handleAbort, setPassphrase }: TInfoProps) => {
  const { t } = useTranslation();

  const [infoStep, setInfoStep] = useState(0);
  const [understood, setUnderstood] = useState(false);

  const handleBack = () => {
    if (infoStep <= 0) {
      handleAbort();
      return null;
    }
    setInfoStep((infoStep) => infoStep - 1);
  };

  const handleContinue = () => {
    if (infoStep === FINAL_INFO_STEP) {
      setPassphrase(true);
      return null;
    }
    setInfoStep((infoStep) => infoStep + 1);
  };

  type TStepData = { titleKey: string; messageKey: string; buttonTextKey: string }[];

  const stepData: TStepData = [
    { titleKey: t('passphrase.intro.title'), messageKey: t('passphrase.intro.message'), buttonTextKey: t('passphrase.what.button') },
    { titleKey: t('passphrase.what.title'), messageKey: t('passphrase.what.message'), buttonTextKey: t('passphrase.why.button') },
    { titleKey: t('passphrase.why.title'), messageKey: t('passphrase.why.message'), buttonTextKey: t('passphrase.considerations.button') },
    { titleKey: t('passphrase.considerations.title'), messageKey: t('passphrase.considerations.message'), buttonTextKey: t('passphrase.how.button') },
    { titleKey: t('passphrase.how.title'), messageKey: t('passphrase.how.message'), buttonTextKey: t('passphrase.summary.button') },
    { titleKey: t('passphrase.summary.title'), messageKey: t('passphrase.summary.understandList'), buttonTextKey: t('passphrase.enable') },
  ];

  const step = stepData[infoStep];
  if (!step) {
    return null;
  }
  return (
    <View
      key={`step-${infoStep}`}
      fullscreen
      minHeight={CONTENT_MIN_HEIGHT}
      onClose={handleAbort}
      verticallyCentered
    >
      <ViewHeader title={step.titleKey} />
      {infoStep < FINAL_INFO_STEP && (
        <ViewContent>
          <MultilineMarkup tagName="p" markup={step.messageKey} />
        </ViewContent>
      )}
      {infoStep >= FINAL_INFO_STEP && (
        <ViewContent>
          <ul>
            <SimpleMarkup key="info-1" tagName="li" markup={t('passphrase.summary.understandList.0')} />
            <SimpleMarkup key="info-2" tagName="li" markup={t('passphrase.summary.understandList.1')} />
            <SimpleMarkup key="info-3" tagName="li" markup={t('passphrase.summary.understandList.2')} />
            <SimpleMarkup key="info-4" tagName="li" markup={t('passphrase.summary.understandList.3')} />
          </ul>
          <Message noIcon type={understood ? 'success' : 'warning'}>
            <Checkbox
              onChange={e => setUnderstood(e.target.checked)}
              id="understood"
              checked={understood}
              label={t('passphrase.summary.understand')}
              checkboxStyle={understood ? 'success' : 'warning'} />
          </Message>
        </ViewContent>
      )}
      <ViewButtons>
        <Button primary onClick={handleContinue} disabled={infoStep >= FINAL_INFO_STEP && !understood}>
          {step.buttonTextKey}
        </Button>
        <Button secondary onClick={handleBack}>
          {t('button.back')}
        </Button>
      </ViewButtons>
    </View>
  );
};

const DisableInfo = ({ handleAbort, setPassphrase }: TInfoProps) => {
  const { t } = useTranslation();

  return (
    <View
      key="step-disable-info1"
      fullscreen
      minHeight={CONTENT_MIN_HEIGHT}
      onClose={handleAbort}
      verticallyCentered>
      <ViewHeader title={t('passphrase.disable')} />
      <ViewContent>
        <MultilineMarkup tagName="p" markup={t('passphrase.disableInfo.message')} />
      </ViewContent>
      <ViewButtons>
        <Button primary onClick={() => setPassphrase(false)}>
          {t('passphrase.disableInfo.button')}
        </Button>
        <Button secondary onClick={handleAbort}>
          {t('button.back')}
        </Button>
      </ViewButtons>
    </View>
  );
};
