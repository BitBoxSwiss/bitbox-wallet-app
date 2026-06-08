// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '@/contexts/AppContext';
import { Button } from '@/components/forms/button';
import { EyeClosed, EyeOpened } from '@/components/icon';
import styles from './hideamountsbutton.module.css';

export const HideAmountsButton = () => {
  const { t } = useTranslation();
  const { hideAmounts, toggleHideAmounts } = useContext(AppContext);

  return (
    <Button className={styles.button} onClick={toggleHideAmounts} transparent>
      {hideAmounts ? <EyeClosed /> : <EyeOpened />}
      <span className={`hide-on-small ${styles.buttonText || ''}`}>
        {hideAmounts
          ? t('newSettings.appearance.hideAmounts.showAmounts')
          : t('newSettings.appearance.hideAmounts.hideAmounts')}
      </span>
    </Button>
  );
};
