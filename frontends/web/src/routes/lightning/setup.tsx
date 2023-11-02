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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Header, Main } from '../../components/layout';
import { View, ViewButtons, ViewContent, ViewHeader } from '../../components/view/view';
import { MultilineMarkup, SimpleMarkup } from '../../utils/markup';
import { Button, Checkbox, Label } from '../../components/forms';
import { PointToBitBox02 } from '../../components/icon';

const CONTENT_MIN_HEIGHT = '38em';

type TSteps = 'intro' | 'disclaimer' | 'confirm';

const LightningSetupSteps = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<TSteps>('intro');
  const [agree, setAgree] = useState(false);

  switch (step) {
  case 'intro':
    return (
      <View
        key="step-intro"
        minHeight={CONTENT_MIN_HEIGHT}
        verticallyCentered>
        <ViewHeader title="What is lightning?" />
        <ViewContent>
          <MultilineMarkup tagName="p" markup="Lightning is a channel based second layer to Bitcoin. It enables you to spend and receive coins instantly and for a very low fee." />
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
      <View
        key="step-disclaimer"
        minHeight={CONTENT_MIN_HEIGHT}
        verticallyCentered>
        <ViewHeader title="How does it work with the BitBoxApp?" />
        <ViewContent>
          <MultilineMarkup tagName="p" markup={`Your lightning wallet will be made using a kye derived from your BitBox02 wallet. That way you can always restore your lightning wallet using your BitBox02 or backup.
          However, unlike the BitBox02, the lightning wallet is a <strong>hot wallet</strong>. This means the keys for your lightning wallet is stored on the BitBoxApp, not on the BitBox02. You should not use the lightning wallet for a large amount of fundsd or long term storage.
          In addition, the lightning feature is currently in beta, meaning you may encounter bugs, reliability issues or may stop fwoking entirely.`} />
          <Label htmlFor="confirm">
            <Checkbox
              id="confirm"
              onChange={() => setAgree(!agree)}
              checked={agree} />
            I have read the information above
          </Label>
        </ViewContent>
        <ViewButtons>
          <Button
            primary
            disabled={!agree}
            onClick={() => setStep('confirm')}>
            Create lightning wallet
          </Button>
          <Button secondary onClick={() => navigate(-1)}>
            {t('button.back')}
          </Button>
        </ViewButtons>
      </View>
    );
  case 'confirm':
    return (
      <View
        key="step-confirm"
        minHeight={CONTENT_MIN_HEIGHT}
        textCenter
        verticallyCentered>
        <ViewHeader
          title="Confirm on device">
          <SimpleMarkup
            tagName="p"
            markup="Confirm on the BitBox02 to create your lightning wallet" />
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
  }
};

export const LightningSetup = () => {
  return (
    <Main>
      <Header title="Create lightning wallet" />
      <LightningSetupSteps />
    </Main>
  );
};
