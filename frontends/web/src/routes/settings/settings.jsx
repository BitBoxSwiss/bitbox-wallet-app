import { Component } from 'preact';
import { Link } from 'preact-router/match';
import { translate } from 'react-i18next';

import { apiGet } from '../../utils/request';

import Reset from './components/reset';
import UpgradeFirmware from './components/upgradefirmware';
import LanguageSwitch from './components/language-switch';

@translate()
export default class Settings extends Component {
    constructor(props) {
        super(props);
        this.state = {
            version: null
        };
    }

    componentDidMount() {
        apiGet('version').then(result => this.setState({ version: result }));
    }

    render({ t }, { version }) {
        return (
            <div style="padding-left: 1rem;">
                <h1>BitBox</h1>
                {version ? <p>Version: {version}</p> : null}
                <p><Reset /></p>
                <p><UpgradeFirmware /></p>
                <p><LanguageSwitch /></p>
                <Link href="/manage-backups/">
                    { t('device.manageBackups') }
                </Link>
            </div>
        );
    }
}
