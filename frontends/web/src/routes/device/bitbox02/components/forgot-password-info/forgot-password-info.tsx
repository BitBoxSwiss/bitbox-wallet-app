// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/dialog/dialog';
import { A } from '@/components/anchor/anchor';
import { Button } from '@/components/forms';
import { Message } from '@/components/message/message';
import styles from './forgot-password-info.module.css';
import { getSupportLink } from '@/utils/url_constants';

const INFO_DELAY_MS = 30000;

export const ForgotPasswordInfo = () => {
  const { t } = useTranslation();
  const [showInfo, setShowInfo] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    infoTimeoutRef.current = setTimeout(() => {
      setShowInfo(true);
    }, INFO_DELAY_MS);

    return () => {
      if (infoTimeoutRef.current) {
        clearTimeout(infoTimeoutRef.current);
      }
    };
  }, []);

  if (!showInfo) {
    return null;
  }

  return (
    <>
      <Message type="info" className={styles.info}>
        <span>{t('unlock.forgotPassword.info')}</span>
        {' '}
        <Button
          transparent
          inline
          className={styles.linkButton}
          onClick={(event) => {
            event.preventDefault();
            setDialogOpen(true);
          }}>
          {t('unlock.forgotPassword.button')}
        </Button>
      </Message>
      <Dialog
        open={dialogOpen}
        noSidebarOffset
        title={t('unlock.forgotPassword.dialogTitle')}
        onClose={() => setDialogOpen(false)}>
        <div className={styles.content}>
          <p>{t('unlock.forgotPassword.dialogDescription')}</p>
          <div>
            <p className={styles.title}>{t('unlock.forgotPassword.title1')}</p>
            <p>{t('unlock.forgotPassword.text1')}</p>
          </div>
          <div>
            <p className={styles.title}>{t('unlock.forgotPassword.title2')}</p>
            <p>{t('unlock.forgotPassword.text2')}</p>
          </div>
          <div className={styles.appendix}>
            <p>{t('unlock.forgotPassword.stillHavingIssues')}</p>
            <A href={getSupportLink()}>
              <p>{t('unlock.forgotPassword.supportLink')}</p>
            </A>
          </div>
        </div>
      </Dialog>
    </>
  );
};
