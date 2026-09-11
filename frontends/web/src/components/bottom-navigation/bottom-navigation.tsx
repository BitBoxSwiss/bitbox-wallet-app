// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import type { TAccount } from '@/api/account';
import type { TDevices } from '@/api/devices';
import { useLoad } from '@/hooks/api';
import { getVersion } from '@/api/bitbox02';
import { useDarkmode } from '@/hooks/darkmode';
import { MenuItem } from './menu-item';
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
  const accountTabURL = (
    onlyHasOneAccount && accountCode
      ? `/account/${accountCode}`
      : '/accounts/all'
  );
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
  const menuItems: Record<TBottomNavItem, { label: string; to: string }> = {
    accounts: { label: accountLabel, to: accountTabURL },
    lightning: { label: lightningLabel, to: '/lightning' },
    market: { label: marketLabel, to: '/market/select' },
    portfolio: { label: portfolioLabel, to: '/account-summary' },
    settings: { label: settingsLabel, to: '/settings' },
  };
  const activeIndex = getBottomNavIndex(bottomNavKey, navItems);
  const {
    containerRef,
    indicatorStyle,
    labelRefs,
  } = useSlidingIndicator(activeIndex, navItems.map(item => menuItems[item].label).join(':'));
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
        {navItems.map(item => (
          <MenuItem
            active={bottomNavKey === item}
            canUpgrade={canUpgrade}
            isDarkMode={isDarkMode}
            key={item}
            label={menuItems[item].label}
            labelRef={setLabelRef(item)}
            name={item}
            pathname={pathname}
            to={menuItems[item].to}
          />
        ))}
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
