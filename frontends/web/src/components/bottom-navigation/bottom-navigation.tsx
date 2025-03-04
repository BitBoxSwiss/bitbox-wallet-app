import { AccountIconSVG, ExchangeIconSVG, MoreIconSVG, PortfolioIconSVG } from '@/components/bottom-navigation/menu-icons';
import styles from './bottom-navigation.module.css';
import { Link, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type MenuItem = {
  label: string;
  icon: ReactNode;
  path: string;
  basePath: string;
};

const MenuItems: MenuItem[] = [
  {
    label: 'accountSummary.portfolio',
    icon: <PortfolioIconSVG />,
    path: '/account-summary',
    basePath: '/account'
  },
  {
    label: 'settings.accounts',
    icon: <AccountIconSVG />,
    path: '/accounts/all',
    basePath: '/accounts'
  },
  {
    label: 'generic.buySell',
    icon: <ExchangeIconSVG />,
    path: '/exchange/info',
    basePath: '/exchange'
  },
  {
    label: 'settings.more',
    icon: <MoreIconSVG />,
    path: '/settings/more',
    basePath: '/settings'
  },
];

export const BottomNavigation = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const isItemActive = (item: MenuItem): boolean => {
    if (location.pathname === item.path) {
      return true;
    }

    if (item.label === 'Portfolio' && location.pathname.startsWith('/account/')) {
      return true;
    }

    if (location.pathname === item.basePath ||
        (location.pathname.startsWith(item.basePath + '/'))) {
      return true;
    }

    return false;
  };

  return (
    <div className={styles.container}>
      {MenuItems.map((item) => (
        <div key={item.label} className={styles.item}>
          <Link
            className={`${styles.link} ${isItemActive(item) ? styles.active : ''}`}
            to={item.path}
          >
            {item.icon}
            <div className={styles.label}>{t(item.label)}</div>
          </Link>
        </div>
      ))}
    </div>
  );
};
