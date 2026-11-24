// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { postActivate } from '@/api/lightning';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { useKeystores } from '@/hooks/backend';
import { useLightning } from '@/hooks/lightning';
import { Header, Main } from '@/components/layout';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { Logo } from '@/components/icon/logo';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { Button, Checkbox } from '@/components/forms';
import { PointToBitBox02 } from '@/components/icon';
import { Status } from '@/components/status/status';
import { MultilineMarkup, SimpleMarkup } from '@/utils/markup';
import { LightningDisclaimerContent } from './disclaimer';
import styles from './activate.module.css';

const CONTENT_MIN_HEIGHT = '38em';

type TSteps = 'intro' | 'information' | 'disclaimer' | 'connect' | 'confirm' | 'activating' | 'success';

export const LightningActivate = () => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { lightningAccount } = useLightning();
  const [agree, setAgree] = useState(false);
  const [step, setStep] = useState<TSteps>('intro');
  const [setupError, setSetupError] = useState<string>();
  const [activationStarted, setActivationStarted] = useState(false);
  const keystores = useKeystores();
  const isConnected = Boolean(keystores?.length);

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
    if (isConnected) {
      setStep('confirm');
    } else {
      setStep('connect');
    }
  }, [isConnected]);

  useEffect(() => {
    if (step === 'connect' && isConnected) {
      setStep('confirm');
    }
  }, [isConnected, step]);

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
      history.back();
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
        <View
          key="step-intro"
          minHeight={CONTENT_MIN_HEIGHT}
          verticallyCentered>
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
        <View
          key="step-information"
          minHeight={CONTENT_MIN_HEIGHT}
          verticallyCentered>
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
              {t('generic.iHaveReadTheInformation')}
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
        <LightningDisclaimerContent
          key="step-disclaimer"
          title={t('lightning.disclaimer.title')}>
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
        <View
          key="step-connect"
          minHeight={CONTENT_MIN_HEIGHT}
          textCenter
          verticallyCentered>
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
          key="step-confirm"
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
        <View
          key="step-success"
          fitContent
          textCenter
          verticallyCentered>
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
        <Status dismissibleKey="" type="warning" hidden={!setupError}>
          {setupError}
        </Status>
      </ContentWrapper>
      <Header
        variant="navigation"
        mobileBackButton={backEnabled}
        onBack={handleBack}
        title={t('lightning.activate.title')}
      />
      {renderSteps()}
    </Main>
  );
};
