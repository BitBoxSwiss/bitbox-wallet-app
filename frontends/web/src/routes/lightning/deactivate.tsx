// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Header, Main } from '../../components/layout';
import { View, ViewButtons, ViewContent } from '../../components/view/view';
import { MultilineMarkup } from '../../utils/markup';
import { Button, Checkbox } from '../../components/forms';
import { postDeactivate } from '../../api/lightning';
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
      await postDeactivate();
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
            <Checkbox
              id="confirm"
              onChange={() => setAgree(!agree)}
              checked={agree}>
              I have read the information above
            </Checkbox>
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
      return <Spinner text={t('lightning.deactivate.wait.title')} />;
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
      <Status dismissible="" type="warning" hidden={!deactivateError}>
        {deactivateError}
      </Status>
      <Header title="Shut down lightning wallet" />
      {renderSteps()}
    </Main>
  );
};
