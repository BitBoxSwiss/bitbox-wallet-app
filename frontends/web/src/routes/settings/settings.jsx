import { Component } from 'preact';
import { ButtonLink } from '../../components/forms';
import { translate } from 'react-i18next';
import { apiGet } from '../../utils/request';
import Reset from './components/reset';
import MobilePairing from './components/mobile-pairing';
import UpgradeFirmware from './components/upgradefirmware';
import LanguageSwitch from './components/language-switch';
import componentStyle from '../../components/style.css';
import style from './settings.css';

@translate()

export default class Settings extends Component {
  state = {
    version: null,
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
      <div class="container">
        <div class="innerContainer">
          <div class="header">
            <h2>Device Settings</h2>
            {
              version && (
                <div class={[style.version, 'flex', 'flex-column', 'flex-end'].join(' ')}>
                  <p>Version: {version}</p>
                  <LanguageSwitch />
                </div>
              )
            }
          </div>
          <div class="content">
            <div class={['flex', 'flex-row', 'flex-between', 'flex-items-center'].join(' ')}>
              <ButtonLink href={`/manage-backups/${deviceID}`}>
                { t('device.manageBackups') }
              </ButtonLink>
              <MobilePairing deviceID={deviceID} />
              <UpgradeFirmware deviceID={deviceID} />
              <Reset deviceID={deviceID} />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
