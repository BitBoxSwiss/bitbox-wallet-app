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

import { Component, h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import { Link, Match } from 'preact-router/match';
import ejectIcon from '../../assets/icons/eject.svg';
import info from '../../assets/icons/info.svg';
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

interface SidebarProps {
    deviceIDs: string[];
    accounts: AccountInterface[];
    accountsInitialized: boolean;
}

type Props = SharedPanelProps & SidebarProps & TranslateProps;

interface SwipeAttributes {
    x: number;
    y: number;
    active?: boolean;
}

export function toggleSidebar() {
    const toggled = !panelStore.state.activeSidebar;
    panelStore.setState({ activeSidebar: toggled });
}

class Sidebar extends Component<Props> {
    private swipe!: SwipeAttributes;

    constructor(props: Props) {
        super(props);
    }

    public componentDidMount() {
        this.registerTouchEvents();
    }

    public componentWillUnmount() {
        this.removeTouchEvents();
    }

    private registerTouchEvents = () => {
        document.addEventListener('touchstart', this.handleTouchStart);
        document.addEventListener('touchmove', this.handleTouchMove);
        document.addEventListener('touchend', this.handleTouchEnd);
    }

    private removeTouchEvents = () => {
        document.removeEventListener('touchstart', this.handleTouchStart);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
    }

    private handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        this.swipe = {
            x: touch.clientX,
            y: touch.clientY,
        };
    }

    private handleTouchMove = (e: TouchEvent) => {
        if (e.changedTouches && e.changedTouches.length) {
            this.swipe.active = true;
        }
    }

    private handleTouchEnd = (e: TouchEvent) => {
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

    public render(
        {
            t,
            deviceIDs,
            accounts,
            accountsInitialized,
            shown,
            activeSidebar,
        }: RenderableProps<Props>,
    ) {
        return (
            <div className="sidebarContainer">
                <div className={['sidebarOverlay', activeSidebar ? 'active' : ''].join(' ')} onClick={toggleSidebar}></div>
                <nav className={['sidebar', activeSidebar ? 'forceShow' : '', shown ? 'withGuide' : ''].join(' ')}>
                    <div className="sidebarLogoContainer">
                        <BitBoxInverted className="sidebarLogo" />
                    </div>
                    <div className="sidebarHeaderContainer">
                        <span className="sidebarHeader">Accounts</span>
                        {
                            debug && (
                                <span className="sidebarHeaderAction">
                                    <a href={`/add-account`} title={t('sidebar.addAccount')}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="12" y1="8" x2="12" y2="16"></line>
                                            <line x1="8" y1="12" x2="16" y2="12"></line>
                                        </svg>
                                    </a>
                                </span>
                            )
                        }
                    </div>
                    {debug &&
                        <div className="sidebarItem">
                            <Link activeClassName="sidebar-active" class="settings" href={`/account-summary`} title={t('accountSummary.title')}>
                                <div className="single">
                                    <img draggable={false} className="sidebar_settings" src={info} alt={t('sidebar.addAccount')} />
                                </div>
                                <span className="sidebar_label">{t('accountSummary.title')}</span>
                            </Link>
                        </div>
                    }
                    { accounts && accounts.map(getAccountLink) }
                    <div className="sidebarHeaderContainer end">
                        <span className="sidebarHeader">Settings</span>
                    </div>
                    {debug &&
                        <div className="sidebarItem">
                            <Link activeClassName="sidebar-active" class="settings" href={`/bitboxbase`} title={t('sidebar.bitboxBase')}>
                                <div className="stacked">
                                    <img draggable={false} className="sidebar_settings" src={settingsGrey} alt={t('sidebar.bitboxBase')} />
                                    <img draggable={false} className="sidebar_settings" src={settings} alt={t('sidebar.bitboxBase')} />
                                </div>
                                <span className="sidebar_label">{t('sidebar.bitboxBase')}</span>
                            </Link>
                        </div>
                    }
                    {
                        (debug && accountsInitialized && deviceIDs.length === 0) && (
                            <div className="sidebarItem">
                                <a href="#" onClick={eject}>
                                    <div className="single">
                                        <img
                                            draggable={false}
                                            className="sidebar_settings"
                                            src={ejectIcon}
                                            alt={t('sidebar.leave')} />
                                    </div>
                                </a>
                            </div>
                        )
                    }
                    {
                        deviceIDs.map(deviceID => (
                            <div key={deviceID} className="sidebarItem">
                                <Link href={`/device/${deviceID}`} activeClassName="sidebar-active" className="settings" title={t('sidebar.device')}>
                                    <div className="single">
                                        <img draggable={false} className="sidebar_settings" src={deviceSettings} alt={t('sidebar.device')} />
                                    </div>
                                    <span className="sidebar_label">{t('sidebar.device')}</span>
                                </Link>
                            </div>
                        ))
                    }
                    <div className="sidebarItem">
                        <Link activeClassName="sidebar-active" class="settings" href={`/settings`} title={t('sidebar.settings')}>
                            <div className="stacked">
                                <img draggable={false} className="sidebar_settings" src={settingsGrey} alt={t('sidebar.settings')} />
                                <img draggable={false} className="sidebar_settings" src={settings} alt={t('sidebar.settings')} />
                            </div>
                            <span className="sidebar_label">{t('sidebar.settings')}</span>
                        </Link>
                    </div>
                </nav>
            </div>
        );
    }
}

function getAccountLink({ coinCode, code, name }: AccountInterface): JSX.Element {
    return (
        <div key={code} className="sidebarItem">
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
