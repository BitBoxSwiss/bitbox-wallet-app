// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router-dom';
import type { TDevices, TPlatformName } from '@/api/devices';
import { useLoad } from '@/hooks/api';
import { getVersion } from '@/api/bitbox02';
import { useDarkmode } from '@/hooks/darkmode';
import { SettingsItem } from './settingsItem/settingsItem';
import {
  AdvancedSettingsIcon,
  AdvancedSettingsIconDark,
  RedDot,
  CogLight,
  CogDark,
  AccountsIconLight,
  AccountsIconDark,
  InfoIconLight,
  InfoIconDark,
  USBLight,
  USBDark,
} from '@/components/icon';
import { useMediaQuery } from '@/hooks/mediaquery';
import styles from './tabs.module.css';

type TWithSettingsTabsProps = {
  children: ReactNode;
  devices: TDevices;
  hasAccounts: boolean;
  hideMobileMenu?: boolean;
};

type TTab = {
  name: string;
  url: string;
  hideMobileMenu?: boolean;
  canUpgrade?: boolean;
  icon?: ReactNode;
};

type TTabs = {
  devices: TDevices;
  hasAccounts: boolean;
  hideMobileMenu?: boolean;
};

export const WithSettingsTabs = ({
  children,
  devices,
  hideMobileMenu,
  hasAccounts,
}: TWithSettingsTabsProps) => {
  return (
    <>
      <div className="hide-on-small">
        <Tabs
          hideMobileMenu={hideMobileMenu}
          devices={devices}
          hasAccounts={hasAccounts}
        />
      </div>
      {children}
    </>
  );
};

export const Tab = ({
  name,
  url,
  hideMobileMenu,
  canUpgrade,
  icon,
}: TTab) => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const upgradeDot = canUpgrade ? (
    <RedDot className={styles.canUpgradeDot} width={8} height={8} />
  ) : null;

  const isManageDeviceItem = url.includes('device-settings');
  const showRedDotOnMobile = isManageDeviceItem && canUpgrade;

  const settingName = icon ? (
    <div className={styles.iconContainer}>
      {icon}
      <span>{name}</span>
    </div>
  ) : (
    <div>{name}</div>
  );

  if (!hideMobileMenu) {
    // Will only be shown on mobile (index/general settings page)
    return (
      <div key={url} className="show-on-small">
        <SettingsItem
          settingName={settingName}
          onClick={() => navigate(url)}
          canUpgrade={showRedDotOnMobile}
        />
      </div>
    );
  }

  return (
    <NavLink
      key={url}
      className={({ isActive }) => isActive ? `${styles.active || ''} hide-on-small` : 'hide-on-small'}
      to={url}
    >
      {isMobile ? settingName : name}
      {upgradeDot}
    </NavLink>
  );
};

type TTabWithVersionCheck = TTab & {
  deviceID: string;
  device: TPlatformName;
};

const TabWithVersionCheck = ({ deviceID, device, ...props }: TTabWithVersionCheck) => {
  const isBitBox02 = device === 'bitbox02';
  const versionInfo = useLoad(isBitBox02 ? () => getVersion(deviceID) : null, [deviceID]);
  return (
    <Tab
      canUpgrade={versionInfo ? versionInfo.canUpgrade : false}
      {...props}
    />
  );
};

export const Tabs = ({ devices, hideMobileMenu, hasAccounts }: TTabs) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const deviceIDs = Object.keys(devices);

  return (
    <div className={styles.container}>
      <Tab
        icon={isDarkMode ? <CogLight className={styles.tabIcon} /> : <CogDark className={styles.tabIcon} />}
        key="general"
        hideMobileMenu={hideMobileMenu}
        name={t('settings.general')}
        url="/settings/general"
      />
      {hasAccounts ? (
        <Tab
          icon={isDarkMode ? <AccountsIconLight className={styles.tabIcon} /> : <AccountsIconDark className={styles.tabIcon} />}
          key="manage-accounts"
          hideMobileMenu={hideMobileMenu}
          name={t('manageAccounts.title')}
          url="/settings/manage-accounts"
        />
      ) : (
        <Tab
          icon={isDarkMode ? <AccountsIconLight className={styles.tabIcon} /> : <AccountsIconDark className={styles.tabIcon} />}
          key="no-accounts"
          hideMobileMenu={hideMobileMenu}
          name={t('manageAccounts.title')}
          url="/settings/no-accounts"
        />
      )}
      {deviceIDs.length ? deviceIDs.map(id => (
        <TabWithVersionCheck
          icon={isDarkMode ? <USBLight className={styles.tabIcon} /> : <USBDark className={styles.tabIcon} />}
          key={`device-${id}`}
          deviceID={id}
          device={devices[id] as TPlatformName}
          hideMobileMenu={hideMobileMenu}
          name={t('sidebar.device')}
          url={`/settings/device-settings/${id}`}
        />
      )) : (
        <Tab
          icon={isDarkMode ? <USBLight className={styles.tabIcon} /> : <USBDark className={styles.tabIcon} />}
          key="no-device"
          hideMobileMenu={hideMobileMenu}
          name={t('sidebar.device')}
          url="/settings/no-device-connected"
        />
      )}
      <Tab
        icon={isDarkMode ? <AdvancedSettingsIcon className={styles.tabIcon} /> : <AdvancedSettingsIconDark className={styles.tabIcon} />}
        key="advanced-settings"
        hideMobileMenu={hideMobileMenu}
        name={t('settings.advancedSettings')}
        url="/settings/advanced-settings"
      />
      <Tab
        icon={isDarkMode ? <InfoIconLight className={styles.tabIcon} /> : <InfoIconDark className={styles.tabIcon} />}
        key="about"
        hideMobileMenu={hideMobileMenu}
        name={t('settings.about')}
        url="/settings/about"
      />
    </div>
  );
};
