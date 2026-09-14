// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogButtons, DialogScrollContent } from '@/components/dialog/dialog';
import { Button, Checkbox } from '@/components/forms';
import { Header, Main } from '@/components/layout';
import { Message } from '@/components/message/message';
import { AppContext } from '@/contexts/AppContext';
import styles from './testnet-warning.module.css';

type TWarningProps = {
  onAccept: () => void;
  onCancel: () => void;
};

const LightningTestnetWarning = ({ onAccept, onCancel }: TWarningProps) => {
  const { t } = useTranslation();
  const [understood, setUnderstood] = useState(false);

  return (
    <Main>
      <Header title={<h2>{t('lightning.accountLabel')}</h2>} />
      <Dialog open title={t('lightning.accountLabel')} onClose={onCancel}>
        <DialogScrollContent>
          <Message type="warning">
            <strong>{t('lightning.testnetWarning.title')}</strong>
            <p>{t('lightning.testnetWarning.message')}</p>
          </Message>
          <div className={styles.acknowledgement}>
            <Checkbox
              id="lightning-testnet-warning-understood"
              checked={understood}
              onChange={event => setUnderstood(event.target.checked)}
              label={t('lightning.testnetWarning.checkboxLabel')}
            />
          </div>
        </DialogScrollContent>
        <DialogButtons>
          <Button primary disabled={!understood} onClick={onAccept}>
            {t('button.done')}
          </Button>
        </DialogButtons>
      </Dialog>
    </Main>
  );
};

type TProps = {
  active: boolean;
  children: ReactNode;
};

export const LightningTestnetGuard = ({ active, children }: TProps) => {
  const { isTesting, sessionConfig, updateSessionConfig } = useContext(AppContext);
  const { key } = useLocation();
  const navigate = useNavigate();

  if (!active) {
    return children;
  }
  if (isTesting === undefined) {
    return null;
  }
  if (!isTesting || sessionConfig.lightningTestnetWarningAccepted) {
    return children;
  }

  const cancel = () => {
    if (key === 'default') {
      navigate('/', { replace: true });
    } else {
      navigate(-1);
    }
  };

  return (
    <LightningTestnetWarning
      onAccept={() => updateSessionConfig({ lightningTestnetWarningAccepted: true })}
      onCancel={cancel}
    />
  );
};
