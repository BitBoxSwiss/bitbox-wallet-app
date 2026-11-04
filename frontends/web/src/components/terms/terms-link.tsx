// SPDX-License-Identifier: Apache-2.0

import { type ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/forms';
import { Dialog } from '@/components/dialog/dialog';
import { AppContext } from '@/contexts/AppContext';
import style from './terms.module.css';

type TProps = {
  children: ReactNode;
  provider: string;
};

export const TermsLink = ({ children, provider }: TProps) => {
  const { t } = useTranslation();
  const { guideShown, toggleGuide } = useContext(AppContext);
  const [open, setOpen] = useState(false);
  const title = t('guide.disclaimer.title', { provider });

  return (
    <>
      <div className={style.guideLinkContainer}>
        <Button transparent inline className={style.guideLink} onClick={() => {
          if (guideShown) {
            toggleGuide();
          }
          setOpen(true);
        }}>
          {t('guide.disclaimer.link', { provider })}
        </Button>
      </div>
      {createPortal(
        <Dialog large title={title} open={open} onClose={() => setOpen(false)}>
          {children}
        </Dialog>,
        document.body,
      )}
    </>
  );
};
