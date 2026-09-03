// SPDX-License-Identifier: Apache-2.0

import { Link } from 'react-router-dom';
import { RedDot } from '@/components/icon';
import { NewBadge } from '@/components/new-badge/new-badge';
import { MenuIcon } from './menu-icons';
import type { TBottomNavItem } from './utils';
import styles from './bottom-navigation.module.css';

type TProps = {
  active: boolean;
  canUpgrade: boolean;
  isDarkMode: boolean;
  label: string;
  labelRef: (element: HTMLSpanElement | null) => void;
  name: TBottomNavItem;
  pathname: string;
  to: string;
};

export const MenuItem = ({
  active,
  canUpgrade,
  isDarkMode,
  label,
  labelRef,
  name,
  pathname,
  to,
}: TProps) => {
  const labelElement = (
    <span className={styles.label} ref={labelRef}>
      {label}
    </span>
  );

  return (
    <Link className={`${styles.link || ''} ${active ? (styles.active || '') : ''}`} to={to}>
      <MenuIcon active={active} isDarkMode={isDarkMode} name={name} />
      {name === 'market' ? (
        <span className={styles.marketplaceLabel}>
          {labelElement}
          <NewBadge
            className={styles.marketplaceNudgeDot}
            configKey="hasSeenMarketplaceNudge"
            hideOnPathPrefix="/market/"
            pathname={pathname}
            type="dot"
          />
        </span>
      ) : name === 'settings' ? (
        <span className={styles.settingsLabel}>
          {labelElement}
          {canUpgrade && <RedDot className={styles.redDot} width={8} height={8} />}
        </span>
      ) : labelElement}
    </Link>
  );
};
