/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { share } from '../../decorators/share';
import { translate, TranslateProps } from '../../decorators/translate';
import { TSharedProps as SharedPanelProps, store as panelStore, toggle as toggleGuide } from '../guide/guide';
import { GuideActive, MenuLight, MenuDark } from '../icon';
import { toggleSidebar } from '../sidebar/sidebar';
import style from './header.module.css';

interface HeaderProps {
    title?: string | JSX.Element | JSX.Element[];
    narrow?: boolean;
    hideSidebarToggler?: boolean;
    children?: ReactNode;
}
type Props = HeaderProps & SharedPanelProps & TranslateProps;

const Header = ({
  sidebarStatus,
  narrow,
  title,
  hideSidebarToggler,
  shown,
  guideExists,
  children
}: Props) => {
  const { t } = useTranslation();

  const toggle = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!shown) {
      toggleGuide();
    }
    return false;
  };

  return (
    <div className={[style.container, sidebarStatus ? style[sidebarStatus] : ''].join(' ')}>
      <div className={[style.header, narrow ? style.narrow : ''].join(' ')}>
        <div className={`${style.sidebarToggler} ${hideSidebarToggler ? style.hideSidebarToggler : ''}`} onClick={toggleSidebar}>
          <MenuDark className="show-in-lightmode" />
          <MenuLight className="show-in-darkmode" />
        </div>
        <div className={style.title}>{title}</div>
        <div className={style.children}>
          {children}
          {
            guideExists && (
              <span className={style.guideIconContainer}>
                <a href="#" onClick={toggle} className={[style.guideIcon, shown ? style.disabled : ''].join(' ')}>
                  <GuideActive />
                  {t('guide.toggle.open')}
                </a>
              </span>
            )
          }
        </div>
      </div>
    </div>
  );
};

const SharedHeader = share<SharedPanelProps, HeaderProps & TranslateProps>(panelStore)(Header);
const TranslatedHeader = translate()(SharedHeader);
export { TranslatedHeader as Header };
