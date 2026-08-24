// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import type { TAccount } from '@/api/account';
import type { TDevices } from '@/api/devices';
import { AccountIconSVG, LightningIconSVG, MarketIconSVG, PortfolioIconSVG } from '@/components/bottom-navigation/menu-icons';
import { useLoad } from '@/hooks/api';
import { getVersion } from '@/api/bitbox02';
import { CogBlue, CogDark, CogLight, RedDot } from '@/components/icon';
import { NewBadge } from '@/components/new-badge/new-badge';
import { useDarkmode } from '@/hooks/darkmode';
import { useAndroidKeyboardVisible } from './use-android-keyboard-visible';
import { useSlidingIndicator } from './use-sliding-indicator';
import { getBottomNavIndex, getBottomNavItems, getBottomNavKey, type TBottomNavItem } from './utils';
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
  const { isDarkMode } = useDarkmode();
  const { pathname } = useLocation();
  const deviceID = Object.keys(devices)[0];
  const isBitBox02 = deviceID && devices[deviceID] === 'bitbox02';
  const versionInfo = useLoad(isBitBox02 ? () => getVersion(deviceID) : null, [deviceID, isBitBox02]);
  const canUpgrade = versionInfo ? versionInfo.canUpgrade : false;

  const onlyHasOneAccount = activeAccounts.length === 1;
  const accountCode = activeAccounts[0]?.code || '';
  const accountTabURL = onlyHasOneAccount && accountCode
    ? `/account/${accountCode}`
    : '/accounts/all';
  const onlyHasLightningAccount = hasLightningAccount && activeAccounts.length === 0;
  const showAccounts = !onlyHasLightningAccount;
  const showMarket = !onlyHasLightningAccount;
  const accountLabel = onlyHasOneAccount ? t('account.account') : t('account.accounts');
  const portfolioLabel = t('accountSummary.portfolio');
  const lightningLabel = 'Lightning';
  const marketLabel = t('generic.buySell');
  const navItems = getBottomNavItems({ hasLightningAccount, showAccounts, showMarket });
  const settingsLabel = t('sidebar.settings');

  const bottomNavKey = getBottomNavKey(pathname);
  const portfolioActive = bottomNavKey === 'portfolio';
  const accountsActive = bottomNavKey === 'accounts';
  const lightningActive = bottomNavKey === 'lightning';
  const marketActive = bottomNavKey === 'market';
  const settingsActive = bottomNavKey === 'settings';
  const InactiveSettingsIcon = isDarkMode ? CogLight : CogDark;
  const SettingsIcon = settingsActive ? CogBlue : InactiveSettingsIcon;
  const activeIndex = getBottomNavIndex(bottomNavKey, navItems);
  const {
    containerRef,
    indicatorStyle,
    labelRefs,
  } = useSlidingIndicator(activeIndex, navItems.map(item => ({
    portfolio: portfolioLabel,
    accounts: accountLabel,
    lightning: lightningLabel,
    market: marketLabel,
    settings: settingsLabel,
  }[item])).join(':'));
  const androidKeyboardVisible = useAndroidKeyboardVisible();
  const setLabelRef = (item: TBottomNavItem) => (element: HTMLSpanElement | null) => {
    labelRefs.current[navItems.indexOf(item)] = element;
  };

  if (androidKeyboardVisible) {
    return null;
  }

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
          <span ref={setLabelRef('portfolio')}>
            {portfolioLabel}
          </span>
        </Link>
        {showAccounts && (
          <Link
            className={`
              ${styles.link || ''}
              ${accountsActive ? (styles.active || '') : ''}
            `}
            to={accountTabURL}
          >
            <AccountIconSVG />
            <span ref={setLabelRef('accounts')}>
              {accountLabel}
            </span>
          </Link>
        )}
        {hasLightningAccount && (
          <Link
            className={`
              ${styles.link || ''}
              ${lightningActive && styles.active || ''}
            `}
            to="/lightning"
          >
            <LightningIconSVG />
            <span ref={setLabelRef('lightning')}>
              {lightningLabel}
            </span>
          </Link>
        )}
        {showMarket && (
          <Link
            className={`
              ${styles.link || ''}
              ${marketActive && styles.active || ''}
            `}
            to="/market/select"
          >
            <MarketIconSVG />
            <span className={styles.marketplaceLabel}>
              <span ref={setLabelRef('market')}>
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
        )}
        <Link
          className={`
            ${styles.link || ''}
            ${settingsActive ? (styles.active || '') : ''}
          `}
          to="/settings"
        >
          <SettingsIcon alt="" height={24} width={24} />
          <span className={styles.settingsLabel}>
            <span ref={setLabelRef('settings')}>
              {settingsLabel}
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
