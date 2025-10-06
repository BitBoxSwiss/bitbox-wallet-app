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
import type { TDevices } from '@/api/devices';
import type { IAccount } from '@/api/account';
import { deregisterTest } from '@/api/keystores';
import { getVersion } from '@/api/bitbox02';
import { debug } from '@/utils/env';
import { AppLogoInverted, Logo } from '@/components/icon/logo';
import { CloseXWhite, Cog, CogGray, Coins, Device, Eject, Linechart, RedDot, ShieldGray } from '@/components/icon';
import { getAccountsByKeystore } from '@/routes/account/utils';
import { SkipForTesting } from '@/routes/device/components/skipfortesting';
import { AppContext } from '@/contexts/AppContext';
import { Button } from '@/components/forms';
import { ConnectedKeystore } from '../keystore/connected-keystore';
import style from './sidebar.module.css';

type SidebarProps = {
  devices: TDevices;
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

const eject = (e: React.SyntheticEvent): void => {
  deregisterTest();
  e.preventDefault();
};

const Sidebar = ({
  devices,
  accounts,
}: SidebarProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [ canUpgrade, setCanUpgrade ] = useState(false);
  const { activeSidebar, toggleSidebar } = useContext(AppContext);

  const deviceIDs: string[] = Object.keys(devices);

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

  const keystores = useKeystores();

  const handleSidebarItemClick = (event: React.SyntheticEvent) => {
    const el = (event.target as Element).closest('a');
    if (el!.classList.contains('sidebarActive') && window.innerWidth <= 901) {
      toggleSidebar();
    }
  };

  const accountsByKeystore = getAccountsByKeystore(accounts);
  const userInSpecificAccountMarketPage = (pathname.startsWith('/market'));

  return (
    <div className={style.sidebarContainer}>
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
          <div
            key="account-summary"
            className={`${style.sidebarItem || ''} ${style.sidebarPortfolio || ''}`}
          >
            <NavLink
              className={({ isActive }) => isActive ? style.sidebarActive : ''}
              to={'/account-summary'}
              title={t('accountSummary.title')}
              onClick={handleSidebarItemClick}>
              <div className={style.single}>
                <Linechart />
              </div>
              <span className={style.sidebarLabel}>{t('accountSummary.title')}</span>
            </NavLink>
          </div>
        ) : null }

        { accountsByKeystore.map(keystore => (
          <div key={`keystore-${keystore.keystore.rootFingerprint}`}>
            <div className={style.sidebarHeaderContainer}>
              <ConnectedKeystore
                accountsByKeystore={accountsByKeystore}
                className={style.sidebarHeader}
                keystore={keystore.keystore}
                connectedIconOnly={true}
              />
            </div>
            { keystore.accounts.map(acc => (
              <GetAccountLink key={`account-${acc.code}`} {...acc} handleSidebarItemClick={handleSidebarItemClick} />
            ))}
          </div>
        )) }

        <div key="services" className={[style.sidebarHeaderContainer, style.end].join(' ')}></div>
        { accounts.length ? (
          <>
            <div key="market" className={style.sidebarItem}>
              <NavLink
                className={({ isActive }) => isActive || userInSpecificAccountMarketPage ? style.sidebarActive : ''}
                to="/market/info">
                <div className={style.single}>
                  <Coins />
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
                  <ShieldGray alt={t('sidebar.insurance')} />
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
              <CogGray alt={t('sidebar.settings')} />
              <Cog alt={t('sidebar.settings')} />
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
                <Device />
              </div>
              <span className={style.sidebarLabel}>
                {t('testWallet.connect.title')}
              </span>
            </SkipForTesting>
          </div>
        ) : null }
        {(debug && keystores?.some(({ type }) => type === 'software') && deviceIDs.length === 0) && (
          <div key="eject" className={style.sidebarItem}>
            <Button transparent onClick={eject} className={style.closeSoftwareKeystore}>
              <div className={style.single}>
                <Eject alt={t('sidebar.leave')} />
              </div>
              <span className={style.sidebarLabel}>
                {t('testWallet.disconnect.title')}
              </span>
            </Button>
          </div>
        )}
      </nav>
    </div>
  );
};

export { Sidebar };
