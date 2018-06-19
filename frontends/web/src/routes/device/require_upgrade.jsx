import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet } from '../../utils/request';
import UpgradeFirmware from './settings/components/upgradefirmware';
import style from './device.css';
import { Guide } from '../../components/guide/guide';

@translate()
export default class RequireUpgrade extends Component {
    state = {
        firmwareVersion: null
    }

    componentDidMount() {
        apiGet('devices/' + this.props.deviceID + '/info').then(({ version }) => {
            this.setState({
                firmwareVersion: version.replace('v', ''),
            });
        });
    }

    render({ deviceID, guide }, { firmwareVersion }) {
        return (
            <div class="contentWithGuide"><div className={style.container}>
                <p>A firmware upgrade is required for your BitBox.</p>
                <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} />
              </div>
              <Guide guide={guide} screen="require_upgrade" />
            </div>
        );
    }
}
