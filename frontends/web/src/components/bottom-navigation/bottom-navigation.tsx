/**
 * Copyright 2025 Shift Crypto AG
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

import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { AccountIconSVG, ExchangeIconSVG, MoreIconSVG, PortfolioIconSVG } from '@/components/bottom-navigation/menu-icons';
import styles from './bottom-navigation.module.css';

export const BottomNavigation = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <div className={styles.container}>
      <Link
        className={`${styles.link} ${pathname.startsWith('/account-summary') ? styles.active : ''}`}
        to="/account-summary"
      >
        <PortfolioIconSVG />
        {t('accountSummary.portfolio')}
      </Link>
      <Link
        className={`${styles.link} ${pathname.startsWith('/account/') || pathname.startsWith('/accounts/') ? styles.active : ''}`}
        to="/accounts/all"
      >
        <AccountIconSVG />
        {t('settings.accounts')}
      </Link>
      <Link
        className={`${styles.link} ${pathname.startsWith('/exchange/') ? styles.active : ''}`}
        to="/exchange/info"
      >
        <ExchangeIconSVG />
        {t('generic.buySell')}
      </Link>
      <Link
        className={`${styles.link} ${pathname.startsWith('/settings') || pathname.startsWith('/bitsurance/') ? styles.active : ''}`}
        to="/settings/more"
      >
        <MoreIconSVG />
        {t('settings.more')}
      </Link>
    </div>
  );
};
