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
import { useSlidingIndicator } from './use-sliding-indicator';
import { getBottomNavIndex, getBottomNavKey } from './utils';
import styles from './bottom-navigation.module.css';

type Props = {
  activeAccounts: TAccount[];
  devices: TDevices;
};

export const BottomNavigation = ({
  activeAccounts,
  devices,
}: Props) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const deviceID = Object.keys(devices)[0];
  const isBitBox02 = deviceID && devices[deviceID] === 'bitbox02';
  const versionInfo = useLoad(isBitBox02 ? () => getVersion(deviceID) : null, [deviceID, isBitBox02]);
  const canUpgrade = versionInfo ? versionInfo.canUpgrade : false;

  const onlyHasOneAccount = activeAccounts.length === 1;
  const accountCode = activeAccounts[0]?.code || '';
  const accountLabel = onlyHasOneAccount ? t('account.account') : t('account.accounts');
  const portfolioLabel = t('accountSummary.portfolio');
  const marketLabel = t('generic.buySell');
  const moreLabel = t('settings.more');

  const bottomNavKey = getBottomNavKey(pathname);
  const portfolioActive = bottomNavKey === 'portfolio';
  const accountsActive = bottomNavKey === 'accounts';
  const marketActive = bottomNavKey === 'market';
  const moreActive = bottomNavKey === 'more';
  const activeIndex = getBottomNavIndex(bottomNavKey);
  const {
    containerRef,
    indicatorStyle,
    labelRefs,
  } = useSlidingIndicator(activeIndex, `${portfolioLabel}:${accountLabel}:${marketLabel}:${moreLabel}`);

  return (
    <>
      <div aria-hidden="true" className={styles.bottomGlass} />
      <div className={styles.container} ref={containerRef}>
        <Link
          className={`
            ${styles.link || ''}
            ${portfolioActive && styles.active || ''}
          `}
          to="/account-summary"
        >
          <PortfolioIconSVG />
          <span ref={element => labelRefs.current[0] = element}>
            {portfolioLabel}
          </span>
        </Link>
        <Link
          className={`
            ${styles.link || ''}
            ${accountsActive ? (styles.active || '') : ''}
          `}
          to={
            onlyHasOneAccount && accountCode ?
              `/account/${accountCode}` :
              '/accounts/all'
          }
        >
          <AccountIconSVG />
          <span ref={element => labelRefs.current[1] = element}>
            {accountLabel}
          </span>
        </Link>
        <Link
          className={`
            ${styles.link || ''}
            ${marketActive && styles.active || ''}
          `}
          to="/market/select"
        >
          <MarketIconSVG />
          <span className={styles.marketplaceLabel}>
            <span ref={element => labelRefs.current[2] = element}>
              {marketLabel}
            </span>
            <NewBadge
              className={styles.marketplaceNudgeDot}
              configKey="hasSeenMarketplaceNudge"
              hideOnPathPrefix="/market/"
              pathname={pathname}
              type="dot"
            />
          </span>
        </Link>
        <Link
          className={`
            ${styles.link || ''}
            ${moreActive ? (styles.active || '') : ''}
          `}
          to="/settings/more"
        >
          <MoreIconSVG />
          <span className={styles.moreLabel}>
            <span ref={element => labelRefs.current[3] = element}>
              {moreLabel}
            </span>
            {canUpgrade && (
              <RedDot
                className={styles.redDot}
                width={8}
                height={8}
              />
            )}
          </span>
        </Link>
        {indicatorStyle && (
          <span
            aria-hidden="true"
            className={styles.activeIndicator}
            style={indicatorStyle}
          />
        )}
      </div>
    </>
  );
};
