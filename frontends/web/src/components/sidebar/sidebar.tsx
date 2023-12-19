/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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
import { Link, NavLink } from 'react-router-dom';
import { TKeystores, subscribeKeystores, TUnsubscribe, getKeystores } from '../../api/keystores';
import { IAccount } from '../../api/account';
import coins from '../../assets/icons/coins.svg';
import ejectIcon from '../../assets/icons/eject.svg';
import shieldIcon from '../../assets/icons/shield_grey.svg';
import info from '../../assets/icons/info.svg';
import settings from '../../assets/icons/settings-alt.svg';
import settingsGrey from '../../assets/icons/settings-alt_disabled.svg';
import { share } from '../../decorators/share';
import { translate, TranslateProps } from '../../decorators/translate';
import { debug } from '../../utils/env';
import { apiPost } from '../../utils/request';
import Logo, { AppLogoInverted } from '../icon/logo';
import { useLocation } from 'react-router';
import { CloseXWhite, USBSuccess } from '../icon';
import { getAccountsByKeystore, isAmbiguiousName, isBitcoinOnly } from '../../routes/account/utils';
import { SkipForTesting } from '../../routes/device/components/skipfortesting';
import { Store } from '../../decorators/store';
import { Badge } from '../badge/badge';
import style from './sidebar.module.css';

interface SidebarProps {
    deviceIDs: string[];
    accounts: IAccount[];
}

export type SharedPanelProps = {
  // eslint-disable-next-line react/no-unused-prop-types
  activeSidebar: boolean;
  // eslint-disable-next-line react/no-unused-prop-types
  sidebarStatus: string;
}

type Props = SharedPanelProps & SidebarProps & TranslateProps;

type TGetAccountLinkProps = IAccount & { handleSidebarItemClick: ((e: React.SyntheticEvent) => void) };

interface SwipeAttributes {
    x: number;
    y: number;
    active?: boolean;
}

export const panelStore = new Store<SharedPanelProps>({
  activeSidebar: false,
  sidebarStatus: '',
});

export function toggleSidebar() {
  const toggled = !panelStore.state.activeSidebar;
  panelStore.setState({ activeSidebar: toggled });
}

export function setSidebarStatus(status: string) {
  panelStore.setState({ sidebarStatus: status });
}

const GetAccountLink = ({ coinCode, code, name, handleSidebarItemClick }: TGetAccountLinkProps) => {
  const { pathname } = useLocation();
  const active = (pathname === `/account/${code}`) || (pathname.startsWith(`/account/${code}/`));
  return (
    <div key={code} className={style.sidebarItem}>
      <Link
        className={active ? style.sidebarActive : ''}
        to={`/account/${code}`}
        onClick={handleSidebarItemClick}
        title={name}>
        <Logo stacked coinCode={coinCode} alt={name} />
        <span className={style.sidebarLabel}>{name}</span>
      </Link>
    </div>
  );
};

type State = {
  keystores: TKeystores;
}

class Sidebar extends Component<Props> {
  private swipe!: SwipeAttributes;
  private unsubscribeFn?: TUnsubscribe;

  public readonly state: State = {
    keystores: [],
  };

  public componentDidMount() {
    this.registerTouchEvents();
    getKeystores().then(keystores => this.setState({ keystores }, () => {
      this.unsubscribeFn = subscribeKeystores(keystores => this.setState({ keystores }));
    }));
  }

  public componentWillUnmount() {
    this.removeTouchEvents();
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
    }
  }

  private registerTouchEvents = () => {
    document.addEventListener('touchstart', this.handleTouchStart);
    document.addEventListener('touchmove', this.handleTouchMove);
    document.addEventListener('touchend', this.handleTouchEnd);
  };

  private removeTouchEvents = () => {
    document.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
  };

  private handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    this.swipe = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (this.props.sidebarStatus !== 'forceHidden') {
      if (e.changedTouches && e.changedTouches.length) {
        this.swipe.active = true;
      }
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (this.props.sidebarStatus !== 'forceHidden') {
      const touch = e.changedTouches[0];
      const travelX = Math.abs(touch.clientX - this.swipe.x);
      const travelY = Math.abs(touch.clientY - this.swipe.y);
      const validSwipe = window.innerWidth <= 901 && this.swipe.active && travelY < 100 && travelX > 70;
      if ((!panelStore.state.activeSidebar && validSwipe && this.swipe.x < 60) ||
                (panelStore.state.activeSidebar && validSwipe && this.swipe.x > 230)) {
        toggleSidebar();
      }
      this.swipe = {
        x: 0,
        y: 0,
        active: false,
      };
    }
  };

  private handleSidebarItemClick = (e: React.SyntheticEvent) => {
    const el = (e.target as Element).closest('a');
    if (el!.classList.contains('sidebarActive') && window.innerWidth <= 901) {
      toggleSidebar();
    }
  };

  public render() {
    const { keystores } = this.state;
    const {
      t,
      deviceIDs,
      accounts,
      activeSidebar,
      sidebarStatus,
    } = this.props;
    const hidden = sidebarStatus === 'forceHidden';
    const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
    const accountsByKeystore = getAccountsByKeystore(accounts);
    return (
      <div className={[style.sidebarContainer, hidden ? style.forceHide : ''].join(' ')}>
        <div className={[style.sidebarOverlay, activeSidebar ? style.active : ''].join(' ')} onClick={toggleSidebar}></div>
        <nav className={[style.sidebar, activeSidebar ? style.forceShow : ''].join(' ')}>
          <div className={style.sidebarLogoContainer}>
            <Link
              to={accounts.length ? '/account-summary' : '/'}
              onClick={this.handleSidebarItemClick}>
              <AppLogoInverted className={style.sidebarLogo} />
            </Link>
            <button className={style.closeButton} onClick={toggleSidebar}>
              <CloseXWhite />
            </button>
          </div>

          { accounts.length ? (
            <div className={`${style.sidebarItem} ${style.sidebarPortfolio}`}>
              <NavLink
                className={({ isActive }) => isActive ? style.sidebarActive : ''}
                to={'/account-summary'}
                title={t('accountSummary.title')}
                onClick={this.handleSidebarItemClick}>
                <div className={style.single}>
                  <img draggable={false} src={info} />
                </div>
                <span className={style.sidebarLabel}>{t('accountSummary.title')}</span>
              </NavLink>
            </div>
          ) : null }

          { accountsByKeystore.map(keystore => (
            <React.Fragment key={keystore.keystore.rootFingerprint}>
              <div className={style.sidebarHeaderContainer}>
                <span
                  className={style.sidebarHeader}
                  hidden={!keystore.accounts.length}>
                  <span className="p-right-quarter">
                    {`${keystore.keystore.name} `}
                    { isAmbiguiousName(keystore.keystore.name, accountsByKeystore) ? (
                      // Disambiguate accounts group by adding the fingerprint.
                      // The most common case where this would happen is when adding accounts from the
                      // same seed using different passphrases.
                      <> ({keystore.keystore.rootFingerprint})</>
                    ) : null }
                  </span>
                  <Badge
                    className={keystore.keystore.connected ? style.sidebarIconVisible : style.sidebarIconHidden}
                    icon={props => <USBSuccess {...props} />}
                    type="success"
                    title={t('device.keystoreConnected')} />
                </span>
              </div>

              { keystore.accounts.map(acc => <GetAccountLink key={acc.code} {...acc} handleSidebarItemClick={this.handleSidebarItemClick }/>) }
            </React.Fragment>
          )) }

          <div className={[style.sidebarHeaderContainer, style.end].join(' ')}></div>
          { accounts.length ? (
            <>
              <div key="buy" className={style.sidebarItem}>
                <NavLink
                  className={({ isActive }) => isActive ? style.sidebarActive : ''}
                  to="/buy/info"
                >
                  <div className={style.single}>
                    <img draggable={false} src={coins} alt={t('sidebar.exchanges')} />
                  </div>
                  <span className={style.sidebarLabel}>
                    {hasOnlyBTCAccounts ? t('accountInfo.buyCTA.buy', { unit: 'Bitcoin' }) : t('sidebar.buy')}
                  </span>
                </NavLink>
              </div>
              <div key="insurance" className={style.sidebarItem}>
                <NavLink
                  className={({ isActive }) => isActive ? style.sidebarActive : ''}
                  to="/bitsurance/bitsurance"
                >
                  <div className={style.single}>
                    <img draggable={false} src={shieldIcon} alt={t('sidebar.insurance')} />
                  </div>
                  <span className={style.sidebarLabel}>{t('sidebar.insurance')}</span>
                </NavLink>
              </div>
            </>
          ) : null }

          <div key="settings-new" className={style.sidebarItem}>
            <NavLink
              className={({ isActive }) => isActive ? style.sidebarActive : ''}
              to={'/settings'}
              title={t('sidebar.settings')}
              onClick={this.handleSidebarItemClick}>
              <div className="stacked">
                <img draggable={false} src={settingsGrey} alt={t('sidebar.settings')} />
                <img draggable={false} src={settings} alt={t('sidebar.settings')} />
              </div>
              <span className={style.sidebarLabel}>{t('sidebar.settings')}</span>
            </NavLink>
          </div>
          { !keystores || keystores.length === 0 ? <SkipForTesting /> : null }
          {(debug && keystores?.some(({ type }) => type === 'software') && deviceIDs.length === 0) && (
            <div key="eject" className={style.sidebarItem}>
              <a href="#" onClick={eject}>
                <div className={style.single}>
                  <img
                    draggable={false}
                    src={ejectIcon}
                    alt={t('sidebar.leave')} />
                </div>
              </a>
            </div>
          )}
        </nav>
      </div>
    );
  }
}

function eject(e: React.SyntheticEvent): void {
  apiPost('test/deregister');
  e.preventDefault();
}

const guideShareHOC = share<SharedPanelProps, SidebarProps & TranslateProps>(panelStore)(Sidebar);
const translateHOC = translate()(guideShareHOC);
export { translateHOC as Sidebar };
