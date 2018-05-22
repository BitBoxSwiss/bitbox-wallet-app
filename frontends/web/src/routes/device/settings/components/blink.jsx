import { Component } from 'preact';
import { route } from 'preact-router';
import { Button } from '../../../../components/forms';
import { apiPost } from '../../../../utils/request';
import 'preact-material-components/Dialog/style.css';

export default class Blink extends Component {
    blinkDevice = () => {
        apiPost('devices/' + this.props.deviceID + '/blink');
    };

    render({}, {}) {
        return (
            <Button primary onClick={() => this.blinkDevice()}>Blink</Button>
        );
    }
}
