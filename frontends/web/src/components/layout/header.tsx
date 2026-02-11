// SPDX-License-Identifier: Apache-2.0

import React, { ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { GuideActive, MenuLight, MenuDark } from '@/components/icon';
import { AppContext } from '@/contexts/AppContext';
import { Button } from '@/components/forms';
import style from './header.module.css';

type Props = {
  title?: string | JSX.Element | JSX.Element[];
  hideSidebarToggler?: boolean;
  children?: ReactNode;
};

export const Header = ({
  title,
  hideSidebarToggler,
  children,
}: Props) => {
  const { t } = useTranslation();

  const { guideExists, toggleGuide, toggleSidebar } = useContext(AppContext);

  const toggle = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!guideExists) {
      return false;
    }
    toggleGuide();
    return false;
  };

  return (
    <div className={style.container}>
      <div className={style.header}>
        <div
          className={`
            hide-on-small
            ${style.sidebarToggler || ''}
            ${hideSidebarToggler && style.hideSidebarToggler || ''}
          `}
          onClick={toggleSidebar}
        >
          <MenuDark className="show-in-lightmode" />
          <MenuLight className="show-in-darkmode" />
        </div>
        <div className={style.title}>{title}</div>
        <div className={style.children}>
          {children}
          {/* keeps this button in
          layout to prevent flicker when
          guide appears/disappears */}
          <Button
            transparent
            disabled={!guideExists}
            onClick={toggle}
            className={`
              ${style.guideClose || ''}
              ${!guideExists && style.guideDisabled || ''} 
            `}
          >
            <GuideActive />
            <span className={`hide-on-small ${style.guideCloseText || ''}`}>
              {t('guide.toggle.open')}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};
