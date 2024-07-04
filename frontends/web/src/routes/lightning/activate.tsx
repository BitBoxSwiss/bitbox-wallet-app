/**
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
import { useNavigate } from 'react-router-dom';
import { Header, Main } from '../../components/layout';
import { View, ViewButtons, ViewContent, ViewHeader } from '../../components/view/view';
import { MultilineMarkup, SimpleMarkup } from '../../utils/markup';
import { Button, Checkbox, Label } from '../../components/forms';
import { PointToBitBox02 } from '../../components/icon';
import { TKeystores, getKeystores, subscribeKeystores } from '../../api/keystores';
import { unsubscribe } from '../../utils/subscriptions';
import { postActivateNode } from '../../api/lightning';
import { Status } from '../../components/status/status';
import { Spinner } from '../../components/spinner/Spinner';
import { route } from '../../utils/route';

const CONTENT_MIN_HEIGHT = '38em';

type TSteps = 'intro' | 'disclaimer' | 'connect' | 'wait' | 'success';

export const LightningActivate = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agree, setAgree] = useState(false);
  const [keystores, setKeystores] = useState<TKeystores>();
  const [step, setStep] = useState<TSteps>('intro');
  const [setupError, setSetupError] = useState<string>();

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

  const activateNode = useCallback(async () => {
    setStep('wait');

    try {
      await postActivateNode();
      setStep('success');
    } catch (err) {
      setSetupError(String(err));
      setStep('disclaimer');
    }
  }, []);

  const waitForConnect = useCallback(() => {
    if (keystores && keystores.length > 0) {
      activateNode();
    } else {
      setStep('connect');
    }
  }, [keystores, activateNode]);

  useEffect(() => {
    if (step === 'connect' && keystores && keystores.length > 0) {
      activateNode();
    }
  }, [keystores, step, activateNode]);

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
            <Button primary onClick={() => setStep('disclaimer')}>
              {t('button.next')}
            </Button>
            <Button secondary onClick={() => navigate(-1)}>
              {t('button.back')}
            </Button>
          </ViewButtons>
        </View>
      );
    case 'disclaimer':
      return (
        <View key="step-disclaimer" minHeight={CONTENT_MIN_HEIGHT} verticallyCentered>
          <ViewHeader title={t('lightning.activate.disclaimer.title')} />
          <ViewContent>
            <MultilineMarkup
              tagName="p"
              markup={t('lightning.activate.disclaimer.content')}
            />
            <Label htmlFor="confirm">
              <Checkbox id="confirm" onChange={() => setAgree(!agree)} checked={agree} />I have read the information above
            </Label>
          </ViewContent>
          <ViewButtons>
            <Button primary disabled={!agree} onClick={() => waitForConnect()}>
              Create lightning wallet
            </Button>
            <Button secondary onClick={() => navigate(-1)}>
              {t('button.back')}
            </Button>
          </ViewButtons>
        </View>
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
            <Button secondary onClick={() => navigate(-1)}>
              {t('button.back')}
            </Button>
          </ViewButtons>
        </View>
      );
    case 'wait':
      return <Spinner text={t('lightning.activate.wait.title')} guideExists={false} />;
    case 'success':
      return (
        <View fitContent textCenter verticallyCentered>
          <ViewContent withIcon="success">
            <p>{t('lightning.activate.success.message')}</p>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => route('/lightning')}>
              {t('button.done')}
            </Button>
          </ViewButtons>
        </View>
      );
    }
  };

  return (
    <Main>
      <Status type="warning" hidden={!setupError}>
        {setupError}
      </Status>
      <Header title={t('lightning.activate.title')} />
      {renderSteps()}
    </Main>
  );
};
