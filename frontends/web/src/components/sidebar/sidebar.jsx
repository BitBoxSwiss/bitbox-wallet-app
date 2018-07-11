import { Component } from 'preact';
import { Link, Match } from 'preact-router/match';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { apiPost, apiGet } from '../../utils/request';
import { debug } from '../../utils/env';
import Logo from '../icon/logo';
import settings from '../../assets/icons/settings-alt.svg';
import settingsGrey from '../../assets/icons/settings-alt_disabled.svg';
import deviceSettings from '../../assets/icons/wallet-dark.svg';
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
    state = {
        accounts: [],
    }

    componentDidMount() {
        apiGet('wallets').then(accounts => this.setState({ accounts }));
    }

    render({
        t,
        deviceIDs,
    }, {
        accounts,
    }) {
        return (
            <nav className="sidebar">
                {
                    accounts && accounts.map(getWalletLink)
                }
                <div className="sidebar_drawer"></div>
                <div className="sidebar_bottom">
                    {
                        (debug && deviceIDs.length === 0) && (
                            <a href="#" onClick={eject}>
                                <img draggable="false" className="sidebar_settings" src={ejectIcon} alt={t('sidebar.leave')} />
                            </a>
                        )
                    }
                    {
                        deviceIDs.map(deviceID => (
                            <div>
                                <Link activeClassName="sidebar-active" class="settings" href={`/device/${deviceID}`} title={ t('sidebar.device') }>
                                    <div class="single">
                                        <img draggable="false" className="sidebar_settings" src={deviceSettings} alt={ t('sidebar.device') } />
                                    </div>
                                    {/* <span className="sidebar_label">{ t('sidebar.settings') }</span> */}
                                </Link>
                            </div>
                        ))
                    }
                    <div>
                        <Link activeClassName="sidebar-active" class="settings" href={`/settings`} title={ t('sidebar.settings') }>
                            <div class="stacked">
                                <img draggable="false" className="sidebar_settings" src={settingsGrey} alt={ t('sidebar.settings') } />
                                <img draggable="false" className="sidebar_settings" src={settings} alt={ t('sidebar.settings') } />
                            </div>
                            {/* <span className="sidebar_label">{ t('sidebar.settings') }</span> */}
                        </Link>
                    </div>
                </div>
            </nav>
        );
    }
}

function getWalletLink({ code, name }) {
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
    route('/', true);
    e.preventDefault();
}

export default Sidebar;
