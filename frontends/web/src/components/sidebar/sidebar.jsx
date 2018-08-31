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

import { Component } from 'preact';
import { Link, Match } from 'preact-router/match';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { apiPost } from '../../utils/request';
import { debug } from '../../utils/env';
import Logo, { BitBoxInverted } from '../icon/logo';
import arrowIcon from '../../assets/icons/chevrons-right.svg';
import settings from '../../assets/icons/settings-alt.svg';
import settingsGrey from '../../assets/icons/settings-alt_disabled.svg';
import deviceSettings from '../../assets/icons/wallet-light.svg';
import ejectIcon from '../../assets/icons/eject.svg';

const labelMap = {
    'btc-p2pkh': 'BTC',
    'tbtc-p2pkh': 'TBTC',
    'btc-p2wpkh-p2sh': 'BTC',
    'btc-p2wpkh': 'BTC',
    'tbtc-p2wpkh-p2sh': 'TBTC SW',
    'tbtc-p2wpkh': 'TBTC NSW',
    'ltc-p2wpkh-p2sh': 'LTC',
    'ltc-p2wpkh': 'LTC',
    'tltc-p2wpkh-p2sh': 'TLTC',
    'tltc-p2wpkh': 'TLTC NSW',
};

@translate()
class Sidebar extends Component {
    render({
        t,
        deviceIDs,
        accounts,
        accountsInitialized,
        sidebar,
        guideShown,
    }, {
    }) {
        const show = sidebar.shown;
        return (
            <div className={['sidebarContainer', guideShown ? 'withGuide' : ''].join(' ')}>
                <div className={['sidebarOverlay', show ? 'show' : ''].join(' ')} onClick={sidebar.toggle}></div>
                <nav className={['sidebar', show ? 'forceShow' : ''].join(' ')}>
                    <div className="sidebarLogoContainer" style={'opacity:' + (accountsInitialized ? 1 : 0)}>
                        <BitBoxInverted className="sidebarLogo" />
                    </div>
                    {
                        accounts && accounts.map(getAccountLink)
                    }
                    <div className="sidebar_drawer"></div>
                    <div className="sidebar_bottom">
                        {
                            (debug && accountsInitialized && deviceIDs.length === 0) && (
                                <a href="#" onClick={eject}>
                                    <div className="single">
                                        <img
                                            draggable="false"
                                            className="sidebar_settings"
                                            src={ejectIcon}
                                            alt={t('sidebar.leave')} />
                                    </div>
                                </a>
                            )
                        }
                        {
                            deviceIDs.map(deviceID => (
                                <div key={deviceID}>
                                    <Link href={`/device/${deviceID}`} activeClassName="sidebar-active" className="settings" title={t('sidebar.device')}>
                                        <div className="single">
                                            <img draggable="false" className="sidebar_settings" src={deviceSettings} alt={t('sidebar.device')} />
                                        </div>
                                        <span className="sidebar_label">{t('sidebar.device')}</span>
                                    </Link>
                                </div>
                            ))
                        }
                        <div>
                            <Link activeClassName="sidebar-active" class="settings" href={`/settings`} title={t('sidebar.settings')}>
                                <div className="stacked">
                                    <img draggable="false" className="sidebar_settings" src={settingsGrey} alt={t('sidebar.settings')} />
                                    <img draggable="false" className="sidebar_settings" src={settings} alt={t('sidebar.settings')} />
                                </div>
                                <span className="sidebar_label">{t('sidebar.settings')}</span>
                            </Link>
                        </div>
                    </div>
                </nav>
            </div>
        );
    }
}

function getAccountLink({ code, name }) {
    return (
        <div key={code} className="sideBarItem">
            <Match path={`/account/${code}/send`}>
                {({ matches }) => {
                    if (!matches) {
                        return (
                            <Match path={`/account/${code}/receive`}>
                                {({ matches }) => getBackLink(code, name, matches)}
                            </Match>
                        );
                    }
                    return getBackLink(code, name, matches);
                }}
            </Match>
        </div>
    );
}

function getBackLink(code, name, active) {
    return (
        <Link
            activeClassName="sidebar-active"
            className={active ? 'sidebar-active' : ''}
            href={`/account/${code}`}
            title={name}>
            <Logo code={code} className="sidebar_icon" alt={name} />
            <span className="sidebar_label">{ name || labelMap[code] }</span>
        </Link>
    );
}

function eject(e) {
    apiPost('test/deregister');
    console.log('sidebar.jsx route to /'); // eslint-disable-line no-console
    route('/', true);
    e.preventDefault();
}

export default Sidebar;
