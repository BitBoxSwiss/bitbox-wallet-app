/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022-2025 Shift Crypto AG
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

import { useEffect, useRef, useState, ChangeEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { getDeviceInfo } from '@/api/bitbox01';
import { apiPost } from '@/utils/request';
import { PasswordRepeatInput } from '@/components/password';
import { Button, Input, Checkbox } from '@/components/forms';
import { Message } from '@/components/message/message';
import { SwissMadeOpenSource, SwissMadeOpenSourceDark, Alert, Warning } from '@/components/icon';
import { Header } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { LanguageSwitch } from '@/components/language/language';
import { getDarkmode } from '@/components/darkmode/darkmode';
import style from '../bitbox01.module.css';

const STATUS = Object.freeze({
  DEFAULT: 'default',
  CREATING: 'creating',
  CHECKING: 'checking',
  ERROR: 'error',
});

type Props = {
  deviceID: string;
  goBack: () => void;
  onSuccess: () => void;
};

type Agreements = {
  password_change: boolean;
  password_required: boolean;
  funds_access: boolean;
};

export const SeedCreateNew = ({
  deviceID,
  goBack,
  onSuccess,
}: Props) => {
  const { t } = useTranslation();

  const [showInfo, setShowInfo] = useState(true);
  const [status, setStatus] = useState<string>(STATUS.CHECKING);
  const [walletName, setWalletName] = useState('');
  const [backupPassword, setBackupPassword] = useState('');
  const [error, setError] = useState('');
  const [agreements, setAgreements] = useState<Agreements>({
    password_change: false,
    password_required: false,
    funds_access: false,
  });

  const walletNameInput = useRef<HTMLInputElement | null>(null);

  // --- Lifecycle ---
  useEffect(() => {
    checkSDcard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Handlers ---
  const handleFormChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = event.target;
    if (id === 'walletName') {
      setWalletName(value);
    }
  };

  const handleAgreementChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { id, checked } = event.target;
    setAgreements(prev => ({ ...prev, [id]: checked }));
  };

  const setValidBackupPassword = (password: string | null) => {
    setBackupPassword(password === null ? '' : password);
  };

  const validAgreements = () => {
    return Object.values(agreements).every(Boolean);
  };

  const validate = () => {
    const walletInput = walletNameInput.current;
    if (!walletInput || !walletInput.validity.valid || !validAgreements()) {
      return false;
    }
    return backupPassword.trim() !== '' && walletName.trim() !== '';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setStatus(STATUS.CREATING);
    setError('');

    try {
      const data = await apiPost(`devices/${deviceID}/create-wallet`, {
        walletName,
        backupPassword,
      });

      if (!data.success) {
        setStatus(STATUS.ERROR);
        setError(
          t(`seed.error.e${data.code as string}`, {
            defaultValue: data.errorMessage,
          })
        );
      } else {
        onSuccess();
      }
    } catch (err) {
      setStatus(STATUS.ERROR);
      setError(String(err));
    } finally {
      setBackupPassword('');
    }
  };

  const checkSDcard = async () => {
    try {
      const deviceInfo = await getDeviceInfo(deviceID);
      if (deviceInfo?.sdcard) {
        setStatus(STATUS.DEFAULT);
        setError('');
      } else {
        setStatus(STATUS.ERROR);
        setError(t('seed.error.e200'));
        setTimeout(checkSDcard, 2500);
      }
    } catch {
      setStatus(STATUS.ERROR);
      setError(t('seed.error.e200'));
      setTimeout(checkSDcard, 2500);
    }
  };

  const handleStart = () => {
    setShowInfo(false);
    checkSDcard();
  };

  const renderSpinner = () => {
    switch (status) {
    case STATUS.CHECKING:
      return <Spinner text={t('checkSDcard')} />;
    case STATUS.CREATING:
      return <Spinner text={t('seed.creating')} />;
    default:
      return null;
    }
  };

  const content = showInfo ? (
    <div className="box large">
      <ol className="first">
        <li>{t('seed.info.description1')}</li>
        <li>{t('seed.info.description2')}</li>
      </ol>
      <p>{t('seed.info.description3')}</p>
      <p>{t('seed.info.description4')}</p>
      <div className="buttons">
        <Button primary onClick={handleStart} disabled={status !== STATUS.DEFAULT}>
          {t('seed.info.button')}
        </Button>
        <Button secondary onClick={goBack}>
          {t('button.abort')}
        </Button>
      </div>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="box large">
      <div>
        <Input
          pattern="^[0-9a-zA-Z-_]{1,31}$"
          autoFocus
          id="walletName"
          label={t('seed.walletName.label')}
          disabled={status === STATUS.CREATING}
          onInput={handleFormChange}
          ref={walletNameInput}
          value={walletName}
        />
        <PasswordRepeatInput
          label={t('seed.password.label')}
          repeatPlaceholder={t('seed.password.repeatPlaceholder')}
          disabled={status === STATUS.CREATING}
          onValidPassword={setValidBackupPassword}
        />
      </div>
      <div className={style.agreements}>
        <div className="flex flex-row flex-start flex-items-center">
          <Warning style={{ width: 18, marginRight: 10, position: 'relative', bottom: 1 }} />
          <p className={style.agreementsLabel}>{t('seed.description')}</p>
        </div>
        <Checkbox
          id="password_change"
          label={t('seed.agreements.password-change')}
          checked={agreements.password_change}
          onChange={handleAgreementChange}
        />
        <Checkbox
          id="password_required"
          label={t('seed.agreements.password-required')}
          checked={agreements.password_required}
          onChange={handleAgreementChange}
        />
        <Checkbox
          id="funds_access"
          label={t('seed.agreements.funds-access')}
          checked={agreements.funds_access}
          onChange={handleAgreementChange}
        />
      </div>
      <div className="buttons">
        <Button type="submit" primary disabled={!validate() || status === STATUS.CREATING}>
          {t('seed.create')}
        </Button>
        <Button secondary onClick={goBack}>
          {t('button.abort')}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header title={<h2>{t('welcome.title')}</h2>}>
            <LanguageSwitch />
          </Header>
          <div className="content padded narrow isVerticallyCentered">
            <h1 className={[style.title, 'text-center'].join(' ')}>{t('seed.info.title')}</h1>
            {error && (
              <Message type={status === STATUS.ERROR ? 'error' : undefined}>
                <Alert />
                {error}
              </Message>
            )}
            {content}
            <div className="text-center m-top-large">
              {getDarkmode() ? <SwissMadeOpenSourceDark /> : <SwissMadeOpenSource />}
            </div>
          </div>
        </div>
        {renderSpinner()}
      </div>
    </div>
  );
};
