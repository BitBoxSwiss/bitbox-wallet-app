import { NavLink } from 'react-router-dom';
import { TTab } from './hooks/useSettingsTab';
import styles from './tabs.module.css';

type TProps = {
  settingsTabsDetail: TTab[];
}

export const Tabs = ({ settingsTabsDetail }: TProps) => {

  return (
    <div className={styles.container}>
      {settingsTabsDetail.map(tab => (
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
