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

import { h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import { Link, Match } from 'preact-router/match';
import ejectIcon from '../../assets/icons/eject.svg';
import plusCircleDisabled from '../../assets/icons/plus-circle-disabled.svg';
import plusCircle from '../../assets/icons/plus-circle.svg';
import settings from '../../assets/icons/settings-alt.svg';
import settingsGrey from '../../assets/icons/settings-alt_disabled.svg';
import deviceSettings from '../../assets/icons/wallet-light.svg';
import { SharedProps as SharedPanelProps, store as panelStore } from '../../components/guide/guide';
import { share } from '../../decorators/share';
import { translate, TranslateProps } from '../../decorators/translate';
import { AccountInterface } from '../../routes/account/account';
import { debug } from '../../utils/env';
import { apiPost } from '../../utils/request';
import Logo, { BitBoxInverted } from '../icon/logo';
import { setConfig } from '../../utils/config';
import { apiGet } from '../../utils/request';

interface SidebarProps {
    deviceIDs: string[];
    accounts: AccountInterface[];
    accountsInitialized: boolean;
}

type Props = SharedPanelProps & SidebarProps & TranslateProps;

apiGet('config').then(({ frontend }) => {
    if (frontend && frontend.sidebarShown != null) {
        panelStore.setState({ activeSidebar: frontend.sidebarShown });
    } else {
        panelStore.setState({ activeSidebar: false });
    }
});

export function toggleSidebar() {
    const toggled = !panelStore.state.activeSidebar;
    panelStore.setState({ activeSidebar: toggled });
    setConfig({ frontend: { sidebarShown: toggled } });
}

function Sidebar(
    {
        t,
        deviceIDs,
        accounts,
        accountsInitialized,
        shown,
        activeSidebar,
}: RenderableProps<Props>): JSX.Element {
    return (
        <div className="sidebarContainer">
            <div className={['sidebarOverlay', activeSidebar ? 'active' : ''].join(' ')} onClick={toggleSidebar}></div>
            <nav className={['sidebar', activeSidebar ? 'forceShow' : '', shown ? 'withGuide' : ''].join(' ')}>
                <div className="sidebarLogoContainer">
                    <BitBoxInverted className="sidebarLogo" />
                </div>
                {
                    accounts && accounts.map(getAccountLink)
                }
                {debug &&
                    <div className="sideBarItem">
                        <Link activeClassName="sidebar-active" class="settings" href={`/add-account`} title={t('sidebar.addAccount')}>
                            <div className="stacked">
                                <img draggable={false} className="sidebar_settings" src={plusCircleDisabled} alt={t('sidebar.addAccount')} />
                                <img draggable={false} className="sidebar_settings" src={plusCircle} alt={t('sidebar.addAccount')} />
                            </div>
                            <span className="sidebar_label">{t('sidebar.addAccount')}</span>
                        </Link>
                    </div>
                }
                <div className="sidebar_drawer"></div>
                <div className="sidebar_bottom">
                    {
                        (debug && accountsInitialized && deviceIDs.length === 0) && (
                            <a href="#" onClick={eject}>
                                <div className="single">
                                    <img
                                        draggable={false}
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
                                        <img draggable={false} className="sidebar_settings" src={deviceSettings} alt={t('sidebar.device')} />
                                    </div>
                                    <span className="sidebar_label">{t('sidebar.device')}</span>
                                </Link>
                            </div>
                        ))
                    }
                    <div>
                        <Link activeClassName="sidebar-active" class="settings" href={`/settings`} title={t('sidebar.settings')}>
                            <div className="stacked">
                                <img draggable={false} className="sidebar_settings" src={settingsGrey} alt={t('sidebar.settings')} />
                                <img draggable={false} className="sidebar_settings" src={settings} alt={t('sidebar.settings')} />
                            </div>
                            <span className="sidebar_label">{t('sidebar.settings')}</span>
                        </Link>
                    </div>
                </div>
            </nav>
        </div>
    );
}

function getAccountLink({ coinCode, code, name }: AccountInterface): JSX.Element {
    return (
        <div key={code} className="sideBarItem">
            <Match>
                {match => getBackLink(coinCode, code, name, match.url === `/account/${code}` || match.url.startsWith(`/account/${code}/`))}
            </Match>
        </div>
    );
}

function getBackLink(coinCode: string, code: string, name: string, active: boolean): JSX.Element {
    return (
        <Link
            activeClassName="sidebar-active"
            className={active ? 'sidebar-active' : ''}
            href={`/account/${code}`}
            title={name}>
            <Logo coinCode={coinCode} className="sidebar_icon" alt={name} />
            <span className="sidebar_label">{name}</span>
        </Link>
    );
}

function eject(e: Event): void {
    apiPost('test/deregister');
    route('/', true);
    e.preventDefault();
}

const guideShareHOC = share<SharedPanelProps, SidebarProps & TranslateProps>(panelStore)(Sidebar);
const translateHOC = translate<SidebarProps>()(guideShareHOC);
export { translateHOC as Sidebar };
