// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import type { TAccount } from '@/api/account';
import type { TDevices } from '@/api/devices';
import { AccountIconSVG, MarketIconSVG, MoreIconSVG, PortfolioIconSVG } from '@/components/bottom-navigation/menu-icons';
import { useLoad } from '@/hooks/api';
import { getVersion } from '@/api/bitbox02';
import { RedDot } from '@/components/icon';
import { NewBadge } from '@/components/new-badge/new-badge';
import styles from './bottom-navigation.module.css';

type TProps = {
  activeAccounts: TAccount[];
  devices: TDevices;
  hasLightningAccount: boolean;
};

export const BottomNavigation = ({
  activeAccounts,
  devices,
  hasLightningAccount,
}: TProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const deviceID = Object.keys(devices)[0];
  const isBitBox02 = deviceID && devices[deviceID] === 'bitbox02';
  const versionInfo = useLoad(isBitBox02 ? () => getVersion(deviceID) : null, [deviceID, isBitBox02]);
  const canUpgrade = versionInfo ? versionInfo.canUpgrade : false;

  const accountCount = activeAccounts.length + (hasLightningAccount ? 1 : 0);
  const onlyHasOneAccount = accountCount === 1;
  const accountCode = activeAccounts[0]?.code || '';
  const accountTabURL = onlyHasOneAccount && accountCode
    ? `/account/${accountCode}`
    : onlyHasOneAccount && hasLightningAccount
      ? '/lightning'
      : '/accounts/all';
  const onlyHasLightningAccount = hasLightningAccount && activeAccounts.length === 0;

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
          ${pathname.startsWith('/account/') || pathname.startsWith('/accounts/') || pathname.startsWith('/lightning') ? (styles.active || '') : ''}
        `}
        to={accountTabURL}
      >
        <AccountIconSVG />
        {onlyHasOneAccount ? t('account.account') : t('account.accounts')}
      </Link>
      {!onlyHasLightningAccount && (
        <Link
          className={`
            ${styles.link || ''}
            ${pathname.startsWith('/market/') && styles.active || ''}
          `}
          to="/market/select"
        >
          <MarketIconSVG />
          <span className={styles.marketplaceLabel}>
            {t('generic.buySell')}
            <NewBadge
              className={styles.marketplaceNudgeDot}
              configKey="hasSeenMarketplaceNudge"
              hideOnPathPrefix="/market/"
              pathname={pathname}
              type="dot"
            />
          </span>
        </Link>
      )}
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
