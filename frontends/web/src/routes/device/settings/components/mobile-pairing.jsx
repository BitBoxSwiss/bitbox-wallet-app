import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../../../../components/forms';
import QRCode from '../../../../routes/account/receive/qrcode';
import { apiPost } from '../../../../utils/request';
import Dialog from '../../../../components/dialog/dialog';
import { apiWebsocket } from '../../../../utils/websocket';

@translate()
export default class MobilePairing extends Component {
    state = {
        channel: null,
        status: false,
    }

    componentDidMount() {
        this.unsubscribe = apiWebsocket(this.onDeviceStatus);
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    onDeviceStatus = ({ type, data, deviceID }) => {
        if (type === 'device' && deviceID === this.props.deviceID) {
            switch (data){
            case 'pairingStarted':
                this.setState({ status: 'started' });
                break;
            case 'pairingTimedout':
                this.setState({ status: 'timeout' });
                break;
            case 'pairingAborted':
                this.setState({ status: 'aborted' });
                break;
            case 'pairingError':
                this.setState({ status: 'error' });
                break;
            case 'pairingSuccess':
                this.setState({ status: 'success' });
                break;
            }
        }
    }

    startPairing = () => {
        this.setState({
            channel: null,
            status: 'loading',
        });
        apiPost('devices/' + this.props.deviceID + '/pairing/start').then(channel => {
            this.setState({
                channel,
                status: 'start',
            });
        });
    }

    render({
        t,
        disabled
    }, {
        channel,
        status,
    }) {
        const content = status === 'start'
            ? (<QRCode data={JSON.stringify(channel)} />)
            : (<p>{t(`pairing.${status}.text`)}</p>);

        return (
            <div>
                <Button primary onClick={this.startPairing} disabled={disabled}>
                    {t('pairing.button')}
                </Button>
                {
                    status && (
                        <Dialog title={t(`pairing.${status}.title`)}>
                            <div class="flex flex-column flex-center flex-items-center">
                                {
                                    channel ? (
                                        content
                                    ) : (
                                        <p>{t('loading')}</p>
                                    )
                                }
                            </div>
                            <div class="flex flex-row flex-end">
                                <Button danger onClick={() => this.setState({ status: false })}>
                                    {t('button.back')}
                                </Button>
                            </div>
                        </Dialog>
                    )
                }
            </div>
        );
    }
}
