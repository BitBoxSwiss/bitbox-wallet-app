// SPDX-License-Identifier: Apache-2.0

import React, { ReactNode, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftDark, GuideActive, MenuLight, MenuDark } from '@/components/icon';
import { AppContext } from '@/contexts/AppContext';
import { useBackNavigation } from '@/contexts/BackNavigationContext';
import { Button } from '@/components/forms';
import { UseBackButton } from '@/hooks/backbutton';
import style from './header.module.css';

type TProps = {
  title?: ReactNode;
} & ({
  // Page headings stay large and left-aligned on mobile.
  variant?: 'page';
  desktopTitle?: never;
  hideSidebarToggler?: boolean;
  children?: ReactNode;
  mobileBackButton?: never;
  onBack?: never;
} | {
  // Navigation headings stay compact and centered, even without a back button.
  variant: 'navigation';
  desktopTitle?: ReactNode;
  hideSidebarToggler?: boolean;
  children?: ReactNode;
  mobileBackButton?: boolean;
  onBack?: () => void;
} | {
  // Fullscreen views have their own desktop heading and no sidebar or guide.
  variant: 'fullscreen';
  desktopTitle?: never;
  hideSidebarToggler?: never;
  children?: never;
  mobileBackButton?: boolean;
  onBack?: () => void;
});

const HeaderBackButton = ({ onBack }: Pick<TProps, 'onBack'>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { goBack } = useBackNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (!goBack()) {
      navigate(-1);
    }
  };

  return (
    <>
      <UseBackButton handler={() => {
        handleBack();
        return false;
      }} />
      <button
        aria-label={t('button.back')}
        className={style.backButton}
        onClick={handleBack}
        type="button"
      >
        <ChevronLeftDark />
      </button>
    </>
  );
};

export const Header = ({
  title,
  desktopTitle = title,
  hideSidebarToggler,
  mobileBackButton = false,
  variant = 'page',
  onBack,
  children,
}: TProps) => {
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
    <div className={`
      ${style.container || ''}
      ${variant === 'page' && style.page || ''}
      ${variant === 'fullscreen' && style.fullscreen || ''}
    `}>
      <div className={style.header}>
        {variant !== 'fullscreen' && (
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
        )}
        {variant !== 'page' && (
          <div className={style.mobileNavigation}>
            {mobileBackButton && <HeaderBackButton onBack={onBack} />}
          </div>
        )}
        {/* Keep the desktop spacer even when there is no title. */}
        <div className={style.title}>
          {variant !== 'fullscreen' && desktopTitle !== undefined && desktopTitle !== null && (
            <h2 className={style.desktopTitle}>{desktopTitle}</h2>
          )}
          {variant !== 'page' && title !== undefined && title !== null && (
            <h1 className={style.mobileTitle}>{title}</h1>
          )}
        </div>
        {variant !== 'fullscreen' && (
          <div className={style.children}>
            {children}
            {guideExists && (
              <Button
                transparent
                onClick={toggle}
                className={style.guideClose}
              >
                <GuideActive />
                <span className={`hide-on-small ${style.guideCloseText || ''}`}>
                  {t('guide.toggle.open')}
                </span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
