import { Component } from 'preact';
import { ButtonLink } from '../../components/forms';
import { translate } from 'react-i18next';

import { apiGet } from '../../utils/request';

import Reset from './components/reset';
import MobilePairing from './components/mobile-pairing';
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
        apiGet('devices/' + this.props.deviceID + '/info').then(({ sdcard }) => {
            if (sdcard) {
                alert('Keep the SD card stored securely unless you want to manage backups.');
            }
        });
    }

    render({ t, deviceID }, { version }) {
        return (
            <div style="padding-left: 1rem;">
                <h1>BitBox</h1>
                {version ? <p>Version: {version}</p> : null}
                <p><Reset deviceID={deviceID} /></p>
                <p><MobilePairing deviceID={deviceID} /></p>
                <p><UpgradeFirmware deviceID={deviceID} /></p>
                <p><LanguageSwitch /></p>
                <ButtonLink href={`/manage-backups/${deviceID}`}>
                    { t('device.manageBackups') }
                </ButtonLink>
            </div>
        );
    }
}
