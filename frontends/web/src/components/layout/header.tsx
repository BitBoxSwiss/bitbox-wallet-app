/**
 * Copyright 2018 Shift Devices AG
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

import React, { Component } from 'react';
import MenuIcon from '../../assets/icons/menu.svg';
import { share } from '../../decorators/share';
import { translate, TranslateProps } from '../../decorators/translate';
import { SharedProps as SharedPanelProps, store as panelStore, toggle as toggleGuide } from '../guide/guide';
import { GuideActive } from '../icon';
import { toggleSidebar } from '../sidebar/sidebar';
import style from './header.module.css';

interface HeaderProps {
    title?: string | JSX.Element | JSX.Element[];
    narrow?: boolean;
}
type Props = HeaderProps & SharedPanelProps & TranslateProps;

class Header extends Component<Props> {
  private toggle = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!this.props.shown) {
      toggleGuide();
    }
    return false;
  };

  public render() {
    const { t, title, narrow, children, guideExists, shown, sidebarStatus } = this.props;
    return (
      <div className={[style.container, sidebarStatus ? style[sidebarStatus] : ''].join(' ')}>
        <div className={[style.header, narrow ? style.narrow : ''].join(' ')}>
          <div className={style.sidebarToggler} onClick={toggleSidebar}>
            <img src={MenuIcon} />
          </div>
          <div className={style.title}>{title}</div>
          <div className={style.children}>
            {children}
            {
              guideExists && (
                <span className={style.guideIconContainer}>
                  <a href="#" onClick={this.toggle} className={[style.guideIcon, shown ? style.disabled : ''].join(' ')}>
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
  }
}

const SharedHeader = share<SharedPanelProps, HeaderProps & TranslateProps>(panelStore)(Header);
const TranslatedHeader = translate()(SharedHeader);
export { TranslatedHeader as Header };
