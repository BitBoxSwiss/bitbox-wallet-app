// SPDX-License-Identifier: Apache-2.0

import type { ComponentType, ImgHTMLAttributes } from 'react';
import {
  AccountsIconBlue,
  AccountsIconDark,
  AccountsIconLight,
  CogBlue,
  CogDark,
  CogLight,
  LightningIconBlue,
  LightningIconDark,
  LightningIconLight,
  MarketplaceIconBlue,
  MarketplaceIconDark,
  MarketplaceIconLight,
  PortfolioIconBlue,
  PortfolioIconDark,
  PortfolioIconLight,
} from '@/components/icon';
import type { TBottomNavItem } from './utils';
import styles from './bottom-navigation.module.css';

type TIcon = ComponentType<ImgHTMLAttributes<HTMLImageElement>>;
type TVariant = 'active' | 'dark' | 'light';

const icons: Record<TBottomNavItem, Record<TVariant, TIcon>> = {
  accounts: { active: AccountsIconBlue, dark: AccountsIconDark, light: AccountsIconLight },
  lightning: { active: LightningIconBlue, dark: LightningIconDark, light: LightningIconLight },
  market: { active: MarketplaceIconBlue, dark: MarketplaceIconDark, light: MarketplaceIconLight },
  portfolio: { active: PortfolioIconBlue, dark: PortfolioIconDark, light: PortfolioIconLight },
  settings: { active: CogBlue, dark: CogDark, light: CogLight },
};

type TProps = {
  active: boolean;
  isDarkMode: boolean;
  name: TBottomNavItem;
};

export const MenuIcon = ({ active, isDarkMode, name }: TProps) => {
  const variant = active ? 'active' : isDarkMode ? 'light' : 'dark';
  const Icon = icons[name][variant];
  return <Icon alt="" className={styles.menuIcon} />;
};
