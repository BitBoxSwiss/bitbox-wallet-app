import { Component } from 'preact';

import Dialog from '../../components/dialog/dialog';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import { apiGet, apiPost } from '../../utils/request';

export default class Bootloader extends Component {
    constructor(props) {
        super(props);
        this.state = {
            upgrading: false,
            errMsg: null,
            progress: 0,
            upgradeSuccessful: false
        };
    }

    componentDidMount() {
        this.props.registerOnEvent(this.onEvent.bind(this));
        this.onStatusChanged();
    }

    componentWillUnmount() {
        this.props.registerOnEvent(null);
    }

    onEvent = data => {
        switch(data.data) {
        case "bootloaderStatusChanged":
            this.onStatusChanged();
            break;
        }
    }

    onStatusChanged = () => {
        apiGet("device/bootloader-status").then(status => {
            this.setState({
                upgrading: status.upgrading,
                progress: status.progress,
                upgradeSuccessful: status.upgradeSuccessful,
                errMsg: status.errMsg
            });
        });
    }

    upgradeFirmware = () => {
        apiPost("device/bootloader/upgrade-firmware");
    }

    render({}, { upgrading, progress, upgradeSuccessful, errMsg }) {
        let UpgradeOrStatus = () => {
            if(upgrading) {
                if(upgradeSuccessful) {
                    return (
                        <p>Upgrade successful! Please replug the device. This time, do not touch the button.</p>
                    );
                }
                return <p>Upgrading: {Math.round(progress*100)}%</p>;
            }
            return (
                <Button
                  primary={true}
                  raised={true}
                  onclick={() => { this.upgradeFirmware(); }}
                  >Upgrade Firmware now</Button>
            );
        };
        return (
            <Dialog>
              <p>Hello Bootloader.</p>
              <UpgradeOrStatus/>
              <p>{ errMsg }</p>
            </Dialog>
        );
    }
};
