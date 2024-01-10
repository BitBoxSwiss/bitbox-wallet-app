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

import React, { useContext, useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TKeystores, subscribeKeystores, getKeystores } from '../../api/keystores';
import { IAccount } from '../../api/account';
import coins from '../../assets/icons/coins.svg';
import ejectIcon from '../../assets/icons/eject.svg';
import info from '../../assets/icons/info.svg';
import settings from '../../assets/icons/settings-alt.svg';
import settingsGrey from '../../assets/icons/settings-alt_disabled.svg';
import { debug } from '../../utils/env';
import { apiPost } from '../../utils/request';
import Logo, { AppLogoInverted } from '../icon/logo';
import { useLocation } from 'react-router';
import { CloseXWhite, USBSuccess } from '../icon';
import { getAccountsByKeystore, isAmbiguiousName, isBitcoinOnly } from '../../routes/account/utils';
import { SkipForTesting } from '../../routes/device/components/skipfortesting';
import { Badge } from '../badge/badge';
import { AppContext } from '../../contexts/AppContext';
import style from './sidebar.module.css';

type SidebarProps = {
  deviceIDs: string[];
  accounts: IAccount[];
};

type TGetAccountLinkProps = IAccount & { handleSidebarItemClick: ((e: React.SyntheticEvent) => void) };

const GetAccountLink = ({
  coinCode,
  code,
  name,
  handleSidebarItemClick
}: TGetAccountLinkProps) => {
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

const eject = (e: React.SyntheticEvent): void => {
  apiPost('test/deregister');
  e.preventDefault();
};

const Sidebar = ({
  deviceIDs,
  accounts,
}: SidebarProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { activeSidebar, sidebarStatus, toggleSidebar } = useContext(AppContext);

  useEffect(() => {
    const swipe = {
      active: false,
      x: 0,
      y: 0,
    };

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      swipe.x = touch.clientX;
      swipe.y = touch.clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (
        sidebarStatus !== 'forceHidden'
        && event.changedTouches
        && event.changedTouches.length
      ) {
        swipe.active = true;
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (sidebarStatus !== 'forceHidden') {
        const touch = event.changedTouches[0];
        const travelX = Math.abs(touch.clientX - swipe.x);
        const travelY = Math.abs(touch.clientY - swipe.y);
        const validSwipe = window.innerWidth <= 901 && swipe.active && travelY < 100 && travelX > 70;
        if (
          (!activeSidebar && validSwipe && swipe.x < 60)
          || (activeSidebar && validSwipe && swipe.x > 230)
        ) {
          toggleSidebar();
        }
        swipe.x = 0;
        swipe.y = 0;
        swipe.active = false;
      }
    };

    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeSidebar, sidebarStatus, toggleSidebar]);

  const [keystores, setKeystores] = useState<TKeystores>();

  useEffect(() => {
    getKeystores().then(keystores => {
      setKeystores(keystores);
    });
    // this passes the unsubscribe function directly the return function of useEffect, used when the component unmounts.
    return subscribeKeystores(setKeystores);
  }, []);

  const handleSidebarItemClick = (event: React.SyntheticEvent) => {
    const el = (event.target as Element).closest('a');
    if (el!.classList.contains('sidebarActive') && window.innerWidth <= 901) {
      toggleSidebar();
    }
  };

  const hidden = sidebarStatus === 'forceHidden';
  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const accountsByKeystore = getAccountsByKeystore(accounts);
  const userInSpecificAccountBuyPage = (pathname.startsWith('/buy'));

  return (
    <div className={[style.sidebarContainer, hidden ? style.forceHide : ''].join(' ')}>
      <div className={[style.sidebarOverlay, activeSidebar ? style.active : ''].join(' ')} onClick={toggleSidebar}></div>
      <nav className={[style.sidebar, activeSidebar ? style.forceShow : ''].join(' ')}>
        <div className={style.sidebarLogoContainer}>
          <Link
            to={accounts.length ? '/account-summary' : '/'}
            onClick={handleSidebarItemClick}>
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
              onClick={handleSidebarItemClick}>
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
            { keystore.accounts.map(acc => <GetAccountLink key={acc.code} {...acc} handleSidebarItemClick={handleSidebarItemClick }/>) }
          </React.Fragment>
        )) }

        <div className={[style.sidebarHeaderContainer, style.end].join(' ')}></div>
        { accounts.length ? (
          <div key="buy" className={style.sidebarItem}>
            <NavLink
              className={({ isActive }) => isActive || userInSpecificAccountBuyPage ? style.sidebarActive : ''}
              to="/buy/info">
              <div className={style.single}>
                <img draggable={false} src={coins} />
              </div>
              <span className={style.sidebarLabel}>
                {hasOnlyBTCAccounts ? t('accountInfo.buyCTA.buy', { unit: 'Bitcoin' }) : t('sidebar.buy')}
              </span>
            </NavLink>
          </div>
        ) : null }

        <div key="settings-new" className={style.sidebarItem}>
          <NavLink
            className={({ isActive }) => isActive ? style.sidebarActive : ''}
            to={'/settings'}
            title={t('sidebar.settings')}
            onClick={handleSidebarItemClick}>
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
};

export { Sidebar };