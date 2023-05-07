import { ReactNode } from 'react';
import { MobileHeader } from './mobile-header';
import { NavLink } from 'react-router-dom';
import { route } from '../../../utils/route';
import { SettingsItem } from './settingsItem/settingsItem';
import { ChevronRightDark } from '../../../components/icon';
import { useTranslation } from 'react-i18next';
import styles from './tabs.module.css';

type TWithSettingsTabsProps = {
  children: ReactNode
  deviceIDs: string[]
  hasAccounts: boolean;
  hideMobileMenu?: boolean;
  subPageTitle: string;
}

type TTab = {
  name: string;
  url: string;
  hideMobileMenu?: boolean;
}

type TTabs = {
  deviceIDs: string[];
  hasAccounts: boolean;
  hideMobileMenu?: boolean;
}

export const WithSettingsTabs = ({
  children,
  deviceIDs,
  hideMobileMenu,
  hasAccounts,
  subPageTitle
}: TWithSettingsTabsProps) => {
  return (
    <>
      <div className="show-on-small">
        <MobileHeader subPageTitle={subPageTitle} />
      </div>
      <div className="hide-on-small">
        <Tabs hideMobileMenu={hideMobileMenu} deviceIDs={deviceIDs} hasAccounts={hasAccounts} />
      </div>
      {children}
    </>
  );
};

export const Tab = ({ name, url, hideMobileMenu }: TTab) => {

  if (!hideMobileMenu) {
    // Will only be shown on mobile (index/general settings page)
    return (
      <div key={url} className="show-on-small">
        <SettingsItem
          settingName={name}
          onClick={() => route(url)}
          extraComponent={<ChevronRightDark/>} />
      </div>
    );
  }

  return (
    <NavLink
      className={({ isActive }) => isActive ? `${styles.active} hide-on-small` : 'hide-on-small'}
      to={url}
      key={url}>
      {name}
    </NavLink>
  );
};

export const Tabs = ({ deviceIDs, hideMobileMenu, hasAccounts }: TTabs) => {
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <Tab key="appearance" hideMobileMenu={hideMobileMenu} name={t('settings.appearance')} url="/new-settings/appearance" />
      {hasAccounts ? <Tab key="manage-accounts" hideMobileMenu={hideMobileMenu} name={'Manage accounts'} url="/settings/manage-accounts" /> : null}
      {deviceIDs.map(id => (
        <Tab hideMobileMenu={hideMobileMenu} name={'Device settings'} key={`device-${id}`} url={`/device/${id}`} />
      )) }
      <Tab key="advanced-settings" hideMobileMenu={hideMobileMenu} name={'Advanced settings'} url="/new-settings/advanced-settings" />
      <Tab key="about" hideMobileMenu={hideMobileMenu} name={'About'} url="/new-settings/about" />
    </div>
  );
};
