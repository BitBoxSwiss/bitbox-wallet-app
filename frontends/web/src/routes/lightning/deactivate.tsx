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

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Header, Main } from '../../components/layout';
import { View, ViewButtons, ViewContent } from '../../components/view/view';
import { MultilineMarkup } from '../../utils/markup';
import { Button, Checkbox, Label } from '../../components/forms';
import { postDeactivateNode } from '../../api/lightning';
import { Status } from '../../components/status/status';
import { Spinner } from '../../components/spinner/Spinner';
import { route } from '../../utils/route';

const CONTENT_MIN_HEIGHT = '38em';

type TSteps = 'intro' | 'wait' | 'success';

export const LightningDeactivate = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agree, setAgree] = useState(false);
  const [step, setStep] = useState<TSteps>('intro');
  const [deactivateError, setDeactivateError] = useState<string>();

  const dectivateNode = useCallback(async () => {
    setStep('wait');

    try {
      await postDeactivateNode();
      setStep('success');
    } catch (err) {
      setDeactivateError(String(err));
      setStep('intro');
    }
  }, []);

  const renderSteps = () => {
    switch (step) {
    case 'intro':
      return (
        <View key="step-intro" minHeight={CONTENT_MIN_HEIGHT} verticallyCentered>
          <ViewContent>
            <MultilineMarkup
              tagName="p"
              markup={`Shutting down your lightning wallet will disconnect you from the Greenlight server and you will no longer be able to use your lightning wallet to send and receive.
              Funds on your lightning wallet are not affected, you can still access them again by enabling lightning in the settings and connecting the BitBox02 wallet used to make that wallet.`}
            />
            <Label htmlFor="confirm">
              <Checkbox id="confirm" onChange={() => setAgree(!agree)} checked={agree} />I have read the information above
            </Label>
          </ViewContent>
          <ViewButtons>
            <Button danger disabled={!agree} onClick={() => dectivateNode()}>
              Shut down lightning wallet
            </Button>
            <Button secondary onClick={() => navigate(-1)}>
              {t('button.back')}
            </Button>
          </ViewButtons>
        </View>
      );
    case 'wait':
      return <Spinner text={t('lightning.deactivate.wait.title')} guideExists={false} />;
    case 'success':
      return (
        <View fitContent textCenter verticallyCentered>
          <ViewContent withIcon="success">
            <p>{t('lightning.deactivate.success.message')}</p>
          </ViewContent>
          <ViewButtons>
            <Button primary onClick={() => route('/account-summary')}>
              {t('button.done')}
            </Button>
          </ViewButtons>
        </View>
      );
    }
  };

  return (
    <Main>
      <Status type="warning" hidden={!deactivateError}>
        {deactivateError}
      </Status>
      <Header title="Shut down lightning wallet" />
      {renderSteps()}
    </Main>
  );
};
