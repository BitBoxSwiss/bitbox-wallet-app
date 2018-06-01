import { Component } from 'preact';
import { Link } from 'preact-router/match';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { apiPost, apiGet } from '../../utils/request';
import { debug } from '../../utils/env';
import Logo from '../icon/logo';
import settings from '../../assets/icons/settings-alt.svg';
import deviceSettings from '../../assets/icons/wallet-dark.svg';
import backups from '../../assets/icons/backups.svg';
import ejectIcon from '../../assets/icons/eject.svg';

@translate()
class Sidebar extends Component {
    state = {
        accounts: [],
    }

    componentDidMount() {
        apiGet('wallets').then(accounts => {
            this.setState({ accounts });
        });
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
                        (debug && deviceIDs.length == 0) && (
                            <a href="#" onClick={eject}>
                                <img className="sidebar_settings" src={ejectIcon} />
                                <span className="sidebar_label">{t('sidebar.leave')}</span>
                            </a>
                        )
                    }
                    {
                        deviceIDs.map(deviceID => (
                            <div>
                                <Link activeClassName="sidebar-active" class="settings" href={`/device/${deviceID}`} title={ t('sidebar.settings') }>
                                    <img className="sidebar_settings" src={deviceSettings} alt={ t('sidebar.settings') } />
                                    {/* <span className="sidebar_label">{ t('sidebar.settings') }</span> */}
                                </Link>
                            </div>
                        ))
                    }
                    <div>
                        <Link activeClassName="sidebar-active" class="settings" href={`/settings`} title={ t('sidebar.settings') }>
                            <img className="sidebar_settings" src={settings} alt={ t('sidebar.settings') } />
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
        <div class="sideBarItem">
            <Link key={code} activeClassName="sidebar-active" href={`/account/${code}`} title={name}>
                <Logo code={code} className="sidebar_icon" alt={name} />
                <span className="sidebar_label">{name}</span>
            </Link>
        </div>
    );
}

function eject(e) {
    apiPost('test/deregister');
    route('/', true);
    e.preventDefault();
}

export default Sidebar;
