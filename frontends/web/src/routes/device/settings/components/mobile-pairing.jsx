import { Component } from 'preact';
import { Button } from '../../../../components/forms';
import QRCode from '../../../../routes/account/receive/qrcode';
import { apiGet, apiPost } from '../../../../utils/request';
import Dialog from '../../../../components/dialog/dialog';
import componentStyle from '../../../../components/style.css';


export default class MobilePairing extends Component {
    state = {
        channel: null,
        active: false,
    }

    startPairing = () => {
        this.setState({
            channel: null,
        });
        apiPost('devices/' + this.props.deviceID + '/pairing/start').then(channel => {
            this.setState({
                channel: channel,
                active: true,
            });
        });
    }

    render({ disabled }, {
        channel,
        active,
    }) {
        return (
            <div>
                <Button primary onClick={this.startPairing} disabled={disabled}>Connect Mobile App</Button>
                {
                    active && (
                        <Dialog title="Scan with a Mobile Device">
                            <div class="flex flex-column flex-center flex-items-center">
                                {
                                    channel ? (
                                        <p><QRCode data={JSON.stringify(channel)} /></p>
                                    ) : (
                                        <p>Loading...</p>
                                    )
                                }
                            </div>
                            <div class="flex flex-row flex-end">
                                <Button danger onClick={() => this.setState({ active: false })}>Close</Button>
                            </div>
                        </Dialog>
                    )
                }
            </div>
        );
    }
}
