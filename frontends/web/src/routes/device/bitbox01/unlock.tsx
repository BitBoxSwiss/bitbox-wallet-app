/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2025 Shift Crypto AG
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

import { useState, FormEvent, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { route } from '@/utils/route';
import { apiGet, apiPost } from '@/utils/request';
import { Button } from '@/components/forms';
import { PasswordSingleInput } from '@/components/password';
import { Message } from '@/components/message/message';
import { AppLogo, AppLogoInverted, SwissMadeOpenSource, SwissMadeOpenSourceDark } from '@/components/icon/logo';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { Header, Footer } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { getDarkmode } from '@/components/darkmode/darkmode';

const stateEnum = Object.freeze({
  DEFAULT: 'default',
  WAITING: 'waiting',
  ERROR: 'error',
});

type Props = {
  deviceID: string;
};

type UnlockResponse = {
  success: true;
} | {
  success: false;
  code?: number;
  errorMessage?: string;
  remainingAttempts?: number;
  needsLongTouch?: boolean;
};

export const Unlock = ({ deviceID }: Props) => {
  const { t } = useTranslation();

  const [status, setStatus] = useState<string>(stateEnum.DEFAULT);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [needsLongTouch, setNeedsLongTouch] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');

  const validate = useCallback(() => password.trim() !== '', [password]);

  const handlePasswordChange = (pwd: string | null) => {
    setPassword(pwd === null ? '' : pwd);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setStatus(stateEnum.WAITING);

    try {
      const data: UnlockResponse = await apiPost(`devices/${deviceID}/login`, { password });

      if (data.success) {
        const deviceStatus = await apiGet(`devices/${deviceID}/status`);
        if (deviceStatus === 'seeded') {
          console.info('unlock.tsx route to /account-summary');
          route('/account-summary', true);
        }
      } else {
        if (data.code) {
          setErrorCode(data.code);
        }
        if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts);
        }
        if (data.needsLongTouch !== undefined) {
          setNeedsLongTouch(data.needsLongTouch);
        }

        setErrorMessage(data.errorMessage || '');
        setStatus(stateEnum.ERROR);
      }
    } catch (err) {
      setErrorMessage(String(err));
      setStatus(stateEnum.ERROR);
    } finally {
      setPassword('');
    }
  };

  const darkmode = getDarkmode();

  let submissionState: ReactNode = null;
  switch (status) {
  case stateEnum.DEFAULT:
    submissionState = <p>{t('unlock.description')}</p>;
    break;
  case stateEnum.WAITING:
    submissionState = <Spinner text={t('unlock.unlocking')} />;
    break;
  case stateEnum.ERROR:
    submissionState = (
      <Message type="error">
        {t(`unlock.error.e${errorCode || ''}`, {
          defaultValue: errorMessage,
          remainingAttempts,
          context: needsLongTouch ? 'touch' : 'normal',
        })}
      </Message>
    );
    break;
  default:
    break;
  }

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header title={<h2>{t('welcome.title')}</h2>} />
          <div className="content narrow padded isVerticallyCentered">
            {darkmode ? <AppLogoInverted /> : <AppLogo />}
            <div className="box large">
              {submissionState}
              {status !== stateEnum.WAITING && (
                <form onSubmit={handleSubmit}>
                  <div className="m-top-default">
                    <PasswordSingleInput
                      autoFocus
                      label={t('unlock.input.label')}
                      disabled={status === stateEnum.WAITING}
                      placeholder={t('unlock.input.placeholder')}
                      onValidPassword={handlePasswordChange}
                    />
                  </div>
                  <div className="buttons">
                    <Button
                      primary
                      type="submit"
                      disabled={!validate() || status === stateEnum.WAITING}
                    >
                      {t('button.unlock')}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
          <Footer>
            {darkmode ? <SwissMadeOpenSourceDark /> : <SwissMadeOpenSource />}
          </Footer>
        </div>
      </div>
      <Guide>
        <Entry
          key="guide.unlock.forgotDevicePassword"
          entry={t('guide.unlock.forgotDevicePassword', { returnObjects: true })}
        />
        <Entry
          key="guide.unlock.reset"
          entry={t('guide.unlock.reset', { returnObjects: true })}
        />
      </Guide>
    </div>
  );
};
