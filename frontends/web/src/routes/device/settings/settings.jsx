import { Component } from 'preact';
import { ButtonLink } from '../../../components/forms';
import { translate } from 'react-i18next';
import { apiGet } from '../../../utils/request';
import { Guide, Entry } from '../../../components/guide/guide';
import Spinner from '../../../components/spinner/Spinner';
import Blink from './components/blink';
import RandomNumber from './components/randomnumber';
import HiddenWallet from './components/hiddenwallet';
import Reset from './components/reset';
import MobilePairing from './components/mobile-pairing';
import DeviceLock from './components/device-lock';
import UpgradeFirmware from './components/upgradefirmware';
import Footer from '../../../components/footer/footer';

@translate()
export default class Settings extends Component {
    state = {
        firmwareVersion: null,
        lock: true,
        name: null,
    }

    componentDidMount() {
        apiGet('devices/' + this.props.deviceID + '/info').then(({ version, sdcard, lock, name }) => {
            this.setState({
                firmwareVersion: version.replace('v', ''),
                lock, name
            });
            // if (sdcard) alert('Keep the SD card stored securely unless you want to manage backups.');
        });
    }

    render({
        t,
        deviceID,
        guide,
    }, {
        firmwareVersion,
        lock,
        name,
    }) {
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <div class="headerContainer">
                        <div class="header">
                            <h2>{name === null ? '' : name || 'BitBox'}</h2>
                        </div>
                    </div>
                    <div class="innerContainer scrollableContainer">
                        <div class="content">
                            <div class="flex-1">
                                <div class="subHeaderContainer first">
                                    <div class="subHeader">
                                        <h3>Device</h3>
                                    </div>
                                </div>
                                <div class="buttons wrapped flex flex-row flex-start flex-wrap">
                                    <ButtonLink primary href={`/manage-backups/${deviceID}`} disabled={lock}>{t('device.manageBackups')}</ButtonLink>
                                    <UpgradeFirmware deviceID={deviceID} currentVersion={firmwareVersion} />
                                    <HiddenWallet deviceID={deviceID} disabled={lock} />
                                    <Reset deviceID={deviceID} />
                                </div>
                                <div class="subHeaderContainer">
                                    <div class="subHeader">
                                        <h3>Pairing</h3>
                                    </div>
                                </div>
                                <div class="buttons wrapped flex flex-row flex-start flex-wrap">
                                    <MobilePairing deviceID={deviceID} disabled={lock} />
                                    <DeviceLock deviceID={deviceID} />
                                </div>
                                <div class="subHeaderContainer">
                                    <div class="subHeader">
                                        <h3>Miscellaneous</h3>
                                    </div>
                                </div>
                                <div class="buttons wrapped flex flex-row flex-start flex-wrap">
                                    <Blink deviceID={deviceID} />
                                    <RandomNumber deviceID={deviceID} />
                                </div>
                            </div>
                            <Footer>
                                { firmwareVersion && <p>Firmware Version: {firmwareVersion}</p>}
                            </Footer>
                        </div>
                        { lock && (<Spinner />)}
                    </div>
                </div>
                <Guide guide={guide}>
                    <Entry title="What is a hidden wallet?">
                        <p>It's for plausible deniability.</p>
                    </Entry>
                </Guide>
            </div>
        );
    }
}
