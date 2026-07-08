// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '@/components/forms';
import { Cancel, Checked, Sync, SyncLight } from '@/components/icon';
import { Header, Main } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { useDarkmode } from '@/hooks/darkmode';
import { SimpleMarkup } from '@/utils/markup';
import styles from './set-lnurl-address.module.css';

const CONTENT_MIN_HEIGHT = '38em';
const lnurlDomain = 'bitboxLN.swiss';
// TODO: Remove mocked LNURL values once the backend supports address availability and registration.
const initialUsername = 'tonybanana';
const availableUsername = 'sausageman';
const initialAddress = `${initialUsername}@${lnurlDomain}`;
const noop = () => undefined;

type TStep = 'form' | 'success';
type TAvailability = 'unchecked' | 'available' | 'taken';

const usernameFromAddress = (address: string) => address.split('@')[0]?.trim().toLowerCase() ?? '';

const fullAddress = (address: string) => {
  const username = usernameFromAddress(address);
  return username ? `${username}@${lnurlDomain}` : '';
};

export const LightningSetLnurlAddress = () => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const navigate = useNavigate();
  const [address, setAddress] = useState(initialAddress);
  const [availability, setAvailability] = useState<TAvailability>('unchecked');
  const [step, setStep] = useState<TStep>('form');

  const checkAvailability = (nextAddress: string) => {
    const nextUsername = usernameFromAddress(nextAddress);
    if (!nextUsername || nextUsername === initialUsername) {
      setAvailability('unchecked');
      return;
    }
    setAvailability(nextUsername === availableUsername ? 'available' : 'taken');
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextAddress = event.target.value;
    setAddress(nextAddress);
    checkAvailability(nextAddress);
  };

  const saveAddress = () => {
    if (availability !== 'available') {
      return;
    }
    setAddress(fullAddress(address));
    setStep('success');
  };

  const renderAvailability = () => {
    switch (availability) {
    case 'available':
      return (
        <div className={`${styles.availability || ''} ${styles.available || ''}`}>
          <Checked className={styles.statusIcon} />
          {t('lightning.lnurlAddress.availability.available')}
        </div>
      );
    case 'taken':
      return (
        <div className={`${styles.availability || ''} ${styles.taken || ''}`}>
          <Cancel className={styles.statusIcon} />
          {t('lightning.lnurlAddress.availability.taken')}
        </div>
      );
    case 'unchecked':
      return <div className={styles.availability} />;
    }
  };

  const renderStep = () => {
    switch (step) {
    case 'form':
      return (
        <View key="step-form" minHeight={CONTENT_MIN_HEIGHT} width="min(420px, 100%)">
          <ViewContent>
            <p>{t('lightning.lnurlAddress.description')}</p>
            <p>{t('lightning.lnurlAddress.choose')}</p>
            <SimpleMarkup tagName="p" markup={t('lightning.lnurlAddress.notice')} />
            <Input
              className={styles.addressInput}
              id="lnurlAddress"
              label={t('lightning.lnurlAddress.label')}
              onInput={handleChange}
              value={address}
            >
              <button
                aria-label={t('lightning.lnurlAddress.generate')}
                className={styles.generateButton}
                onClick={noop}
                type="button">
                {isDarkMode ? <SyncLight /> : <Sync />}
              </button>
            </Input>
            {renderAvailability()}
          </ViewContent>
          <ViewButtons>
            <Button primary disabled={availability !== 'available'} onClick={saveAddress}>
              {t('button.save')}
            </Button>
            <Button secondary onClick={() => navigate(-1)}>
              {t('dialog.cancel')}
            </Button>
          </ViewButtons>
        </View>
      );
    case 'success':
      return (
        <View fitContent textCenter verticallyCentered width="min(420px, 100%)">
          <ViewContent withIcon="success">
            <p>{t('lightning.lnurlAddress.success.message')}</p>
            <span className={styles.successAddress}>{address}</span>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate('/settings/lightning-settings')}>
              {t('button.done')}
            </Button>
          </ViewButtons>
        </View>
      );
    }
  };

  return (
    <Main>
      <Header title={t('lightning.lnurlAddress.title')} />
      {renderStep()}
    </Main>
  );
};
