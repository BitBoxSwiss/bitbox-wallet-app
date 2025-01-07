/**
 * Copyright 2023-2025 Shift Crypto AG
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
      <span className={`hide-on-small ${styles.buttonText}`}>
        {hideAmounts
          ? t('newSettings.appearance.hideAmounts.showAmounts')
          : t('newSettings.appearance.hideAmounts.hideAmounts')}
      </span>
    </Button>
  );
};
