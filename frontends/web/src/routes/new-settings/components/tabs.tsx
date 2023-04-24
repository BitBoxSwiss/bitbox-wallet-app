import styles from './tabs.module.css';
import { NavLink } from 'react-router-dom';

type TTab = {
    url: string;
    tabName: string;
}

const Tabs = () => {

  const settingsTabs: TTab[] = [
    { url: '/new-settings/appearance', tabName: 'Appearance' },
    { url: '/new-settings/manage-accounts', tabName: 'Manage accounts' },
    { url: '/new-settings/device-settings', tabName: 'Device settings' },
    { url: '/new-settings/advanced-settings', tabName: 'Advanced settings' },
    { url: '/new-settings/about', tabName: 'About' },
  ];

  return (
    <div className={styles.container}>
      {settingsTabs.map(tab => (
        <NavLink
          className={({ isActive }) => isActive ? styles.active : ''}
          to={tab.url}
          key={tab.url}>
          {tab.tabName}
        </NavLink>
      ))}
    </div>
  );
};

export default Tabs;