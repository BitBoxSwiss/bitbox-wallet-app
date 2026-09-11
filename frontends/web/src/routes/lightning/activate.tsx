// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { Logo } from '@/components/icon/logo';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { useLightning } from '@/hooks/lightning';
import { Header, Main } from '../../components/layout';
import { View, ViewButtons, ViewContent, ViewHeader } from '../../components/view/view';
import { MultilineMarkup, SimpleMarkup } from '../../utils/markup';
import { Button, Checkbox } from '../../components/forms';
import { PointToBitBox02 } from '../../components/icon';
import { TKeystores, getKeystores, subscribeKeystores } from '../../api/keystores';
import { unsubscribe } from '../../utils/subscriptions';
import { postActivate } from '../../api/lightning';
import { Status } from '../../components/status/status';
import { LightningDisclaimerContent } from './disclaimer';
import { LightningTorProxyWarning } from '@/components/banners/lightning-tor-proxy-warning';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import styles from './activate.module.css';

const CONTENT_MIN_HEIGHT = '38em';

type TSteps = 'intro' | 'information' | 'disclaimer' | 'connect' | 'confirm' | 'activating' | 'success';

export const LightningActivate = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lightningAccount } = useLightning();
  const [agree, setAgree] = useState(false);
  const [keystores, setKeystores] = useState<TKeystores>();
  const [step, setStep] = useState<TSteps>('intro');
  const [setupError, setSetupError] = useState<string>();
  const [activationStarted, setActivationStarted] = useState(false);

  const onStateChange = useCallback(async () => {
    try {
      const keystores = await getKeystores();
      setKeystores(keystores);
    } catch (err: any) {}
  }, []);

  useEffect(() => {
    onStateChange();

    const subscriptions = [subscribeKeystores(onStateChange)];
    return () => unsubscribe(subscriptions);
  }, [onStateChange]);

  const activateLightning = useCallback(async () => {
    setActivationStarted(true);
    setSetupError(undefined);

    try {
      await postActivate();
      setStep('success');
    } catch (err) {
      setActivationStarted(false);
      setSetupError(String(err));
      setStep('disclaimer');
    }
  }, []);

  const waitForConnect = useCallback(() => {
    if (keystores && keystores.length > 0) {
      setStep('confirm');
    } else {
      setStep('connect');
    }
  }, [keystores]);

  useEffect(() => {
    if (step === 'connect' && keystores && keystores.length > 0) {
      setStep('confirm');
    }
  }, [keystores, step]);

  useEffect(() => {
    if (step === 'confirm' && !activationStarted) {
      activateLightning();
    }
  }, [activateLightning, activationStarted, step]);

  useEffect(() => {
    if (step === 'confirm' && activationStarted && lightningAccount) {
      setStep('activating');
    }
  }, [activationStarted, lightningAccount, step]);

  const handleBack = () => {
    switch (step) {
    case 'information':
      setStep('intro');
      return;
    case 'disclaimer':
      setStep('information');
      return;
    case 'intro':
    case 'connect':
      navigate(-1);
      return;
    }
  };

  const backEnabled = (
    step === 'intro'
    || step === 'information'
    || step === 'disclaimer'
    || step === 'connect'
  );

  const renderSteps = () => {
    switch (step) {
    case 'intro':
      return (
        <View key="step-intro" minHeight={CONTENT_MIN_HEIGHT} verticallyCentered>
          <ViewHeader title={t('lightning.activate.intro.title')} />
          <ViewContent>
            <MultilineMarkup
              tagName="p"
              markup={t('lightning.activate.intro.content')}
            />
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => setStep('information')}>
              {t('button.next')}
            </Button>
            <DesktopBackButton onClick={handleBack}>
              {t('button.back')}
            </DesktopBackButton>
          </ViewButtons>
        </View>
      );
    case 'information':
      return (
        <View key="step-information" minHeight={CONTENT_MIN_HEIGHT} verticallyCentered>
          <ViewHeader title={t('lightning.activate.disclaimer.title')} />
          <ViewContent>
            <MultilineMarkup
              tagName="p"
              markup={t('lightning.activate.disclaimer.content')}
            />
            <Checkbox
              id="confirm"
              onChange={() => setAgree(!agree)}
              checked={agree}>
              {t('lightning.activate.disclaimer.checkboxLabel')}
            </Checkbox>
          </ViewContent>
          <ViewButtons>
            <Button primary disabled={!agree} onClick={() => setStep('disclaimer')}>
              {t('button.next')}
            </Button>
            <DesktopBackButton onClick={handleBack}>
              {t('button.back')}
            </DesktopBackButton>
          </ViewButtons>
        </View>
      );
    case 'disclaimer':
      return (
        <LightningDisclaimerContent key="step-disclaimer" title={t('lightning.disclaimer.title')}>
          <Button primary onClick={() => waitForConnect()}>
            {t('lightning.disclaimer.continue')}
          </Button>
          <DesktopBackButton onClick={handleBack}>
            {t('button.back')}
          </DesktopBackButton>
        </LightningDisclaimerContent>
      );
    case 'connect':
      return (
        <View key="step-confirm" minHeight={CONTENT_MIN_HEIGHT} textCenter verticallyCentered>
          <ViewHeader title={t('lightning.activate.connect.title')}>
            <SimpleMarkup tagName="p" markup={t('lightning.activate.connect.content')} />
          </ViewHeader>
          <ViewContent>
            <PointToBitBox02 />
          </ViewContent>
          <ViewButtons>
            <DesktopBackButton onClick={handleBack}>
              {t('button.back')}
            </DesktopBackButton>
          </ViewButtons>
        </View>
      );
    case 'confirm':
      return (
        <View
          key="step-create"
          fullscreen
          textCenter
          verticallyCentered
          withMobileSafetyMargin>
          <UseDisableBackButton />
          <ViewHeader title={t('lightning.activate.wait.title')}>
            <p>{t('lightning.activate.wait.confirm')}</p>
          </ViewHeader>
          <ViewContent minHeight="280px">
            <PointToBitBox02 />
          </ViewContent>
          <ViewButtons>
            {/* Empty ViewButtons to avoid layout shift changing between different views */}
          </ViewButtons>
        </View>
      );
    case 'activating':
      return (
        <View
          key="step-activating"
          fullscreen
          textCenter
          verticallyCentered>
          <UseDisableBackButton />
          <ViewContent minHeight="280px">
            <div className={styles.activatingContent}>
              <Logo
                alt={t('lightning.accountLabel')}
                className={styles.lightningLogo}
                coinCode="lightning"
              />
              <p className={styles.waitMessage}>{t('lightning.activate.wait.activating')}</p>
            </div>
          </ViewContent>
          <ViewButtons>
            {/* Empty ViewButtons to avoid layout shift changing between different views */}
          </ViewButtons>
        </View>
      );
    case 'success':
      return (
        <View fitContent textCenter verticallyCentered>
          <ViewContent withIcon="success">
            <p>{t('lightning.activate.success.message')}</p>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => navigate('/lightning')}>
              {t('button.done')}
            </Button>
          </ViewButtons>
        </View>
      );
    }
  };

  return (
    <Main>
      <ContentWrapper>
        <LightningTorProxyWarning />
        <Status dismissibleKey="" type="warning" hidden={!setupError}>
          {setupError}
        </Status>
      </ContentWrapper>
      <Header title={
        <>
          <h2 className="hide-on-small">{t('lightning.activate.title')}</h2>
          <MobileHeader
            onClick={handleBack}
            title={t('lightning.activate.title')}
            variant={backEnabled ? 'back' : 'titleOnly'}
          />
        </>
      } />
      {renderSteps()}
    </Main>
  );
};
