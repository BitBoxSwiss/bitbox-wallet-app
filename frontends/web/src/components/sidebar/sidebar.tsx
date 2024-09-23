/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021-2024 Shift Crypto AG
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
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useKeystores } from '@/hooks/backend';
import { useLightning } from '@/hooks/lightning';
import type { TDevices } from '@/api/devices';
import type { IAccount } from '@/api/account';
import { deregisterTest } from '@/api/keystores';
import { getVersion } from '@/api/bitbox02';
import coins from '@/assets/icons/coins.svg';
import ejectIcon from '@/assets/icons/eject.svg';
import shieldIcon from '@/assets/icons/shield_grey.svg';
import linechart from '@/assets/icons/linechart.svg';
import settings from '@/assets/icons/settings-alt.svg';
import settingsGrey from '@/assets/icons/settings-alt_disabled.svg';
import deviceSettings from '@/assets/icons/wallet-light.svg';
import { debug } from '@/utils/env';
import { AppLogoInverted, Logo } from '@/components/icon/logo';
import { CloseXWhite, RedDot, USBSuccess } from '@/components/icon';
import { getAccountsByKeystore, isAmbiguousName } from '@/routes/account/utils';
import { SkipForTesting } from '@/routes/device/components/skipfortesting';
import { Badge } from '@/components/badge/badge';
import { AppContext } from '@/contexts/AppContext';
import { Button } from '@/components/forms';
import style from './sidebar.module.css';

type SidebarProps = {
  deviceIDs: string[];
  devices: TDevices;
  accounts: IAccount[];
};

type ItemClickProps = { handleSidebarItemClick: (e: React.SyntheticEvent) => void };
type TGetAccountLinkProps = IAccount & ItemClickProps;

const GetAccountLink = ({
  coinCode,
  code,
  name,
  handleSidebarItemClick
}: TGetAccountLinkProps) => {
  const { pathname } = useLocation();
  const active = pathname === `/account/${code}` || pathname.startsWith(`/account/${code}/`);
  return (
    <div className={style.sidebarItem}>
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

const GetLightningLink = ({ handleSidebarItemClick }: ItemClickProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const active = pathname === '/lightning' || pathname.startsWith('/lightning/');
  const lightningName = t('lightning.accountLabel');
  return (
    <div className={style.sidebarItem}>
      <Link className={active ? style.sidebarActive : ''} to={'/lightning'} onClick={handleSidebarItemClick} title={lightningName}>
        <Logo stacked coinCode="lightning" alt={lightningName} />
        <span className={style.sidebarLabel}>{lightningName}</span>
      </Link>
    </div>
  );
};

const eject = (e: React.SyntheticEvent): void => {
  deregisterTest();
  e.preventDefault();
};

const Sidebar = ({
  deviceIDs,
  devices,
  accounts,
}: SidebarProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [ canUpgrade, setCanUpgrade ] = useState(false);
  const { activeSidebar, sidebarStatus, toggleSidebar } = useContext(AppContext);
  const { lightningConfig } = useLightning();

  useEffect(() => {
    const checkUpgradableDevices = async () => {
      setCanUpgrade(false);
      const bitbox02Devices = Object.keys(devices).filter(deviceID => devices[deviceID] === 'bitbox02');

      for (const deviceID of bitbox02Devices) {
        const { canUpgrade } = await getVersion(deviceID);
        if (canUpgrade) {
          setCanUpgrade(true);
          // exit early as we found an upgradable device
          return;
        }
      }
    };

    checkUpgradableDevices();
  }, [devices]);

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

  const keystores = useKeystores();

  const handleSidebarItemClick = (event: React.SyntheticEvent) => {
    const el = (event.target as Element).closest('a');
    if (el!.classList.contains('sidebarActive') && window.innerWidth <= 901) {
      toggleSidebar();
    }
  };

  const hidden = sidebarStatus === 'forceHidden';
  const accountsByKeystore = getAccountsByKeystore(accounts);
  const userInSpecificAccountExchangePage = (pathname.startsWith('/exchange'));

  return (
    <div className={[style.sidebarContainer, hidden ? style.forceHide : ''].join(' ')}>
      <div key="overlay" className={[style.sidebarOverlay, activeSidebar ? style.active : ''].join(' ')} onClick={toggleSidebar}></div>
      <nav className={[style.sidebar, activeSidebar ? style.forceShow : ''].join(' ')}>
        <div key="app-logo" className={style.sidebarLogoContainer}>
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
          <div key="account-summary" className={`${style.sidebarItem} ${style.sidebarPortfolio}`}>
            <NavLink
              className={({ isActive }) => isActive ? style.sidebarActive : ''}
              to={'/account-summary'}
              title={t('accountSummary.title')}
              onClick={handleSidebarItemClick}>
              <div className={style.single}>
                <img draggable={false} src={linechart} />
              </div>
              <span className={style.sidebarLabel}>{t('accountSummary.title')}</span>
            </NavLink>
          </div>
        ) : null }

        {lightningConfig.accounts.length !== 0 && (
          <GetLightningLink key="lightning" handleSidebarItemClick={handleSidebarItemClick} />
        )}

        { accountsByKeystore.map(keystore => (
          <div key={`keystore-${keystore.keystore.rootFingerprint}`}>
            <div className={style.sidebarHeaderContainer}>
              <span
                className={style.sidebarHeader}
                hidden={!keystore.accounts.length}>
                <span className="p-right-quarter">
                  {`${keystore.keystore.name} `}
                  { isAmbiguousName(keystore.keystore.name, accountsByKeystore) ? (
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
            { keystore.accounts.map(acc => (
              <GetAccountLink key={`account-${acc.code}`} {...acc} handleSidebarItemClick={handleSidebarItemClick} />
            ))}
          </div>
        )) }

        <div key="services" className={[style.sidebarHeaderContainer, style.end].join(' ')}></div>
        { accounts.length ? (
          <>
            <div key="exchange" className={style.sidebarItem}>
              <NavLink
                className={({ isActive }) => isActive || userInSpecificAccountExchangePage ? style.sidebarActive : ''}
                to="/exchange/info">
                <div className={style.single}>
                  <img draggable={false} src={coins} />
                </div>
                <span className={style.sidebarLabel}>
                  {t('generic.buySell')}
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

        <div key="settings" className={style.sidebarItem}>
          <NavLink
            className={({ isActive }) => isActive ? style.sidebarActive : ''}
            to={'/settings'}
            title={t('sidebar.settings')}
            onClick={handleSidebarItemClick}>
            <div className="stacked">
              <img draggable={false} src={settingsGrey} alt={t('sidebar.settings')} />
              <img draggable={false} src={settings} alt={t('sidebar.settings')} />
            </div>
            <span className={style.sidebarLabel}>
              {t('sidebar.settings')}
              {canUpgrade && (
                <RedDot className={style.canUpgradeDot} width={8} height={8} />
              )}
            </span>
          </NavLink>
        </div>

        { !keystores || keystores.length === 0 ? (
          <div key="unlock-software-keystore" className={style.sidebarItem}>
            <SkipForTesting className={style.closeSoftwareKeystore}>
              <div className={style.single}>
                <img src={deviceSettings} />
              </div>
              <span className={style.sidebarLabel}>
                Software keystore
              </span>
            </SkipForTesting>
          </div>
        ) : null }
        {(debug && keystores?.some(({ type }) => type === 'software') && deviceIDs.length === 0) && (
          <div key="eject" className={style.sidebarItem}>
            <Button transparent onClick={eject} className={style.closeSoftwareKeystore}>
              <div className={style.single}>
                <img
                  draggable={false}
                  src={ejectIcon}
                  alt={t('sidebar.leave')} />
              </div>
              <span className={style.sidebarLabel}>
                Eject software keystore
              </span>
            </Button>
          </div>
        )}
      </nav>
    </div>
  );
};

export { Sidebar };
