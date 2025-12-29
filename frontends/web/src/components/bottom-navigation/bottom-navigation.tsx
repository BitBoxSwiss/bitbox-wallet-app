// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import type { TAccount } from '@/api/account';
import type { TDevices } from '@/api/devices';
import { AccountIconSVG, MarketIconSVG, MoreIconSVG, PortfolioIconSVG } from '@/components/bottom-navigation/menu-icons';
import { useLoad } from '@/hooks/api';
import { getVersion } from '@/api/bitbox02';
import { RedDot } from '@/components/icon';
import styles from './bottom-navigation.module.css';

type Props = {
  activeAccounts: TAccount[];
  devices: TDevices;
};

export const BottomNavigation = ({ activeAccounts, devices }: Props) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const deviceID = Object.keys(devices)[0];
  const isBitBox02 = deviceID && devices[deviceID] === 'bitbox02';
  const versionInfo = useLoad(isBitBox02 ? () => getVersion(deviceID) : null, [deviceID, isBitBox02]);
  const canUpgrade = versionInfo ? versionInfo.canUpgrade : false;

  const onlyHasOneAccount = activeAccounts.length === 1;
  const accountCode = activeAccounts[0]?.code || '';

  return (
    <div className={styles.container}>
      <Link
        className={`
          ${styles.link || ''}
          ${pathname.startsWith('/account-summary') && styles.active || ''}
        `}
        to="/account-summary"
      >
        <PortfolioIconSVG />
        {t('accountSummary.portfolio')}
      </Link>
      <Link
        className={`
          ${styles.link || ''}
          ${pathname.startsWith('/account/') || pathname.startsWith('/accounts/') ? (styles.active || '') : ''}
        `}
        to={
          onlyHasOneAccount && accountCode ?
            `/account/${accountCode}` :
            '/accounts/all'
        }
      >
        <AccountIconSVG />
        {onlyHasOneAccount ? t('account.account') : t('account.accounts')}
      </Link>
      <Link
        className={`
          ${styles.link || ''}
          ${pathname.startsWith('/market/') && styles.active || ''}
        `}
        to="/market/select"
      >
        <MarketIconSVG />
        {t('generic.buySell')}
      </Link>
      <Link
        className={`
          ${styles.link || ''}
          ${pathname.startsWith('/settings') || pathname.startsWith('/bitsurance/') ? (styles.active || '') : ''}
        `}
        to="/settings/more"
      >
        <MoreIconSVG />
        {canUpgrade && (
          <RedDot
            className={styles.redDot}
            width={8}
            height={8}
          />
        )}
        {t('settings.more')}
      </Link>
    </div>
  );
};
