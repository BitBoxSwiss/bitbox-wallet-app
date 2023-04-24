import { Link, useLocation } from 'react-router-dom';
import styles from './mobileheader.module.css';
import { TTab } from './hooks/useSettingsTab';

type TProps = {
  settingsTabsDetail: TTab[];
}

export const MobileHeader = ({ settingsTabsDetail }: TProps) => {
  const { pathname } = useLocation();
  const activeTabIndex = settingsTabsDetail.findIndex(tab => tab.url === pathname);
  return (
    <div className={styles.container}>
      <Link to={'#'} className={styles.backButton}>Back</Link>
      <h1 className={styles.headerText}>{activeTabIndex >= 0 ? settingsTabsDetail[activeTabIndex].tabName : ''}</h1>
    </div>
  );
};
