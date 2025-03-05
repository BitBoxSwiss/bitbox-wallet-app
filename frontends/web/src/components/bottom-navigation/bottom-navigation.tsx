import { AccountIconSVG, ExchangeIconSVG, MoreIconSVG, PortfolioIconSVG } from '@/components/bottom-navigation/menu-icons';
import styles from './bottom-navigation.module.css';
import { Link, useLocation } from 'react-router-dom';

const MenuItems = [
  {
    label: 'Portfolio',
    icon: <PortfolioIconSVG />,
    path: '/account-summary',
  },
  {
    label: 'Accounts',
    icon: <AccountIconSVG />,
    path: '/accounts',
  },
  {
    label: 'Buy & Sell',
    icon: <ExchangeIconSVG />,
    path: '/exchange/info',
  },
  {
    label: 'More',
    icon: <MoreIconSVG />,
    path: '/more',
  },
];

export const BottomNavigation = () => {
  const location = useLocation();

  return (
    <div className={styles.container}>
      {MenuItems.map((item) => (
        <div key={item.label} className={styles.item}>
          <Link className={`${styles.link} ${location.pathname === item.path ? styles.active : ''}`} to={item.path}>
            {item.icon}
            <div className={styles.label}>{item.label}</div>
          </Link>
        </div>
      ))}
    </div>
  );
};
