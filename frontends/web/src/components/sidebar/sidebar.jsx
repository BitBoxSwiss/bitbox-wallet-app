import { Component } from 'preact';
import { Link } from 'preact-router/match';
import { translate } from 'react-i18next';

import { apiPost, apiGet } from '../../utils/request';
import { debug } from '../../utils/env';
import Logo from '../icon/logo';

import settings from '../../assets/icons/settings.svg';
import ejectIcon from '../../assets/icons/eject.svg';

@translate()
class Sidebar extends Component {
    constructor(props) {
        super(props);
        this.state = { emulated: false };
    }
    componentDidMount() {
        this.setState({ emulated: true });

        // TODO: get device/info back
        // if (debug) {
        //     apiGet('device/info').then(({ name }) => this.setState({ emulated: name === 'Emulated BitBox' }));
        // }
    }
    render({ t, accounts, deviceIDs }, { emulated }) {
        return (
            <nav className="sidebar">
                {accounts.map(getWalletLink)}
                <div className="sidebar_drawer"></div>
                <div className="sidebar_bottom">
                    {emulated && debug ?
                        <a href="#" onClick={eject}>
                            <img className="sidebar_settings" src={ejectIcon} />
                            <span className="sidebar_label">{ t('sidebar.leave') }</span>
                        </a>
                        : null}
                        { deviceIDs.map(deviceID => (
                            <Link activeClassName="sidebar-active" href={`/device/${deviceID}`} title={ t('sidebar.settings') }>
                              <img className="sidebar_settings" src={settings} alt={ t('sidebar.settings') } />
                              <span className="sidebar_label">{ t('sidebar.settings') }</span>
                            </Link>
                        ))}
                </div>
            </nav>
        );
    }
}

function getWalletLink({ code, name }) {
    return (
        <Link key={code} activeClassName="sidebar-active" href={`/account/${code}`} title={name}>
            <Logo code={code} className="sidebar_icon" alt={name} />
            <span className="sidebar_label">{name}</span>
        </Link>
    );
}

function eject(e) {
    apiPost('test/deregister');
    e.preventDefault();
}

export default Sidebar;
