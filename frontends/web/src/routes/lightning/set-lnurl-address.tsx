// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  getLightningAddress,
  getLightningAddressAvailability,
  getLightningAddressDomain,
  postGenerateLightningAddress,
  postRegisterLightningAddress,
} from '@/api/lightning';
import { toLightningErrorMessage } from '@/api/lightning-errors';
import { Button, Input } from '@/components/forms';
import { Cancel, Checked, Sync, SyncLight } from '@/components/icon';
import { Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { useDarkmode } from '@/hooks/darkmode';
import { useDebounce } from '@/hooks/debounce';
import { useMountedRef } from '@/hooks/mount';
import { SimpleMarkup } from '@/utils/markup';
import styles from './set-lnurl-address.module.css';

const CONTENT_MIN_HEIGHT = '38em';
const availabilityDebounceMs = 300;
const usernameRegexp = /^[a-z0-9]+$/;
const maxUsernameLength = 64;

type TStep = 'form' | 'success';
type TAvailability = 'unchecked' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';

const isValidUsername = (username: string) => (
  username.length > 0
    && username.length <= maxUsernameLength
    && usernameRegexp.test(username)
);

const normalizeUsername = (username: string) => username.trim().toLowerCase();

const usernameFromAddress = (address: string | null) => address?.split('@')[0]?.trim().toLowerCase() ?? '';

export const LightningSetLnurlAddress = () => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const navigate = useNavigate();
  const mounted = useMountedRef();
  const availabilityRequestId = useRef(0);
  const [domain, setDomain] = useState('');
  const [username, setUsername] = useState('');
  const [registeredUsername, setRegisteredUsername] = useState('');
  const [address, setAddress] = useState('');
  const [availability, setAvailability] = useState<TAvailability>('unchecked');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<TStep>('form');
  const debouncedUsername = useDebounce(username, availabilityDebounceMs);

  // Load the backend-selected domain and auto-register an initial address if none exists yet.
  useEffect(() => {
    Promise.all([
      getLightningAddressDomain(),
      getLightningAddress(),
    ]).then(([domain, address]) => {
      if (!mounted.current) {
        return;
      }
      const currentUsername = usernameFromAddress(address);
      setDomain(domain);
      setAddress(address ?? '');
      setUsername(currentUsername);
      setRegisteredUsername(currentUsername);
      setAvailability('unchecked');
    }).catch((err) => {
      if (mounted.current) {
        setError(toLightningErrorMessage(t, err));
      }
    });
  }, [mounted, t]);

  // Check availability when the user edits the username, ignoring stale responses.
  useEffect(() => {
    const nextUsername = normalizeUsername(debouncedUsername);
    const requestId = ++availabilityRequestId.current;
    setError('');

    if (!nextUsername || nextUsername === registeredUsername) {
      setAvailability('unchecked');
      return;
    }

    if (!isValidUsername(nextUsername)) {
      setAvailability('invalid');
      return;
    }

    setAvailability('checking');
    getLightningAddressAvailability(nextUsername).then((result) => {
      if (!mounted.current || requestId !== availabilityRequestId.current) {
        return;
      }
      setAvailability(result.available ? 'available' : 'taken');
    }).catch((err) => {
      if (!mounted.current || requestId !== availabilityRequestId.current) {
        return;
      }
      setError(toLightningErrorMessage(t, err));
      setAvailability('error');
    });
  }, [debouncedUsername, mounted, registeredUsername, t]);

  const generateAddress = async () => {
    // Invalidate pending availability responses for the previous username.
    availabilityRequestId.current += 1;
    setIsGenerating(true);
    setError('');
    // The generated username still flows through the debounced availability check below.
    // Keep the UI in checking until that final response arrives to avoid available/checking flicker.
    setAvailability('checking');
    try {
      const generatedAddress = await postGenerateLightningAddress();
      if (!mounted.current) {
        return;
      }
      setUsername(generatedAddress.username);
    } catch (err) {
      if (mounted.current) {
        setError(toLightningErrorMessage(t, err));
        setAvailability('error');
      }
    } finally {
      if (mounted.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleUsernameInput = (value: string) => {
    const nextUsername = normalizeUsername(value);
    // Invalidate pending availability responses while the user is still editing.
    availabilityRequestId.current += 1;
    setUsername(nextUsername);
    setError('');
    setAvailability('unchecked');
  };

  const saveAddress = async () => {
    if (availability !== 'available') {
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const registeredAddress = await postRegisterLightningAddress(username);
      if (!mounted.current) {
        return;
      }
      setAddress(registeredAddress);
      setRegisteredUsername(usernameFromAddress(registeredAddress));
      setStep('success');
    } catch (err) {
      if (mounted.current) {
        setError(toLightningErrorMessage(t, err));
        setAvailability('error');
      }
    } finally {
      if (mounted.current) {
        setIsSaving(false);
      }
    }
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
    case 'invalid':
      return (
        <div className={`${styles.availability || ''} ${styles.taken || ''}`}>
          <Cancel className={styles.statusIcon} />
          {t('error.lightningAddressInvalidUsername')}
        </div>
      );
    case 'checking':
      return (
        <div className={styles.availability}>
          {t('lightning.lnurlAddress.availability.checking')}
        </div>
      );
    case 'error':
      return (
        <div className={`${styles.availability || ''} ${styles.taken || ''}`}>
          {error}
        </div>
      );
    case 'unchecked':
      return <div className={styles.availability} />;
    }
  };

  const renderStep = () => {
    if (!domain && error) {
      return (
        <View textCenter verticallyCentered>
          <ViewContent>
            <p>{t('unknownError', { errorMessage: error })}</p>
          </ViewContent>
          <ViewButtons>
            <Button secondary onClick={() => navigate(-1)}>
              {t('button.back')}
            </Button>
          </ViewButtons>
        </View>
      );
    }

    if (!domain) {
      return <Spinner text={t('lightning.initializing')} />;
    }

    switch (step) {
    case 'form':
      return (
        <View key="step-form" minHeight={CONTENT_MIN_HEIGHT}>
          <ViewContent>
            <p>{t('lightning.lnurlAddress.description')}</p>
            <p>{t('lightning.lnurlAddress.choose')}</p>
            <SimpleMarkup tagName="p" markup={t('lightning.lnurlAddress.notice')} />
            <Input
              className={styles.addressInput}
              classNameInputField={styles.addressInputField}
              id="lnurlAddress"
              label={t('lightning.lnurlAddress.label')}
              onInput={event => handleUsernameInput(event.target.value)}
              value={username}
            >
              <span className={styles.domain}>@{domain}</span>
              <button
                aria-label={t('lightning.lnurlAddress.generate')}
                className={styles.generateButton}
                disabled={isGenerating || isSaving}
                onClick={generateAddress}
                type="button">
                {isDarkMode ? <SyncLight /> : <Sync />}
              </button>
            </Input>
            {renderAvailability()}
          </ViewContent>
          <ViewButtons>
            <Button primary disabled={availability !== 'available' || isSaving} onClick={saveAddress}>
              {t('button.save')}
            </Button>
            <Button secondary disabled={isSaving} onClick={() => navigate(-1)}>
              {t('dialog.cancel')}
            </Button>
          </ViewButtons>
        </View>
      );
    case 'success':
      return (
        <View fitContent textCenter verticallyCentered>
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
