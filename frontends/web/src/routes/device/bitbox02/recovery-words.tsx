// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'wouter';
import { showMnemonic } from '@/api/bitbox02';
import { SimpleMarkup } from '@/utils/markup';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { Header, Main } from '@/components/layout';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button, Checkbox } from '@/components/forms';
import { Phone, PointToBitBox02 } from '@/components/icon';
import { Message } from '@/components/message/message';
import { useMediaQuery } from '@/hooks/mediaquery';
import styles from './recovery-words.module.css';

const CONTENT_MIN_HEIGHT = 'min(56rem, 100vh)';
const WARNING_DELAY_SECONDS = 60;

type TRouteParams = {
  deviceID: string;
};

type TStatus = 'info' | 'progress' | 'success';

export const RecoveryWords = () => {
  const { deviceID = '' } = useParams<TRouteParams>();
  const { t } = useTranslation();

  const [status, setStatus] = useState<TStatus>('info');
  const [agree, setAgree] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState(WARNING_DELAY_SECONDS);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    if (!agree) {
      return;
    }
    const deadline = performance.now() + WARNING_DELAY_SECONDS * 1000;
    const interval = window.setInterval(() => {
      // Measure elapsed time so throttled timers do not prolong the wait.
      const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        window.clearInterval(interval);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [agree]);

  const confirmShowWords = async () => {
    if (!agree || secondsRemaining > 0) {
      return;
    }
    setStatus('progress');
    await showMnemonic(deviceID);
    history.back();
  };

  const handleAbort = () => history.back();

  const recoveryInstructions = (
    <div className={styles.content}>
      <SimpleMarkup
        className={isMobile ? 'm-top-default' : undefined}
        tagName="p"
        markup={t('backup.showMnemonic.warning')} />
      <SimpleMarkup tagName="p" markup={t('backup.showMnemonic.instructions')} />
      <ul>
        <li><strong>{t('backup.showMnemonic.safetyWarnings.noAppsOrWebsites')}</strong></li>
        <li><strong>{t('backup.showMnemonic.safetyWarnings.noDigitalCopies')}</strong></li>
        <li><strong>{t('backup.showMnemonic.safetyWarnings.noSpeaking')}</strong></li>
        <li><strong>{t('backup.showMnemonic.safetyWarnings.safeStorage')}</strong></li>
        <li><strong>{t('backup.showMnemonic.safetyWarnings.noSharing')}</strong></li>
      </ul>
      <Message type="warning" className={styles.callWarning} icon={<Phone alt="" />}>
        {t('backup.showMnemonic.scamWarning')}
      </Message>
    </div>
  );

  if (status === 'progress') {
    return (
      <Main>
        <View
          key="progress"
          fullscreen
          minHeight={CONTENT_MIN_HEIGHT}
          verticallyCentered
          withMobileSafetyMargin>
          <ViewHeader small title={t('backup.showMnemonic.title')} />
          <ViewContent>
            {recoveryInstructions}
            <p>{t('bitbox02Interact.followInstructions')}</p>
            <UseDisableBackButton />
            <PointToBitBox02 />
          </ViewContent>
        </View>
      </Main>
    );
  }

  return (
    <View
      key="info"
      fullscreen
      minHeight={CONTENT_MIN_HEIGHT}
      verticallyCentered>
      <Header
        mobileBackButton
        variant="fullscreen"
        onBack={handleAbort}
        title={t('backup.showMnemonic.title')}
      />
      <ViewHeader className="hide-on-small" small title={t('backup.showMnemonic.title')} />
      <ViewContent>
        {recoveryInstructions}
        <p>
          <Checkbox
            checked={agree}
            id="confirmationCheckbox"
            label={t('generic.iHaveReadTheInformation')}
            onChange={e => {
              setSecondsRemaining(WARNING_DELAY_SECONDS);
              setAgree(e.target.checked);
            }} />
        </p>
      </ViewContent>
      <ViewButtons>
        <div className={styles.continueButton}>
          <Button
            disabled={!agree || secondsRemaining > 0}
            aria-describedby={agree && secondsRemaining > 0 ? 'recovery-words-countdown' : undefined}
            primary
            onClick={confirmShowWords}>
            {t('button.next')}
          </Button>
          <span id="recovery-words-countdown" role="timer" className={styles.countdown}>
            {agree && secondsRemaining > 0 && t('backup.showMnemonic.availableIn', { count: secondsRemaining })}
          </span>
        </div>
        <Button className={`hide-on-small ${styles.cancelButton || ''}`} secondary onClick={handleAbort}>
          {t('dialog.cancel')}
        </Button>
      </ViewButtons>
    </View>
  );
};
