import { Component } from 'preact';
import { Button } from '../../../../components/forms';
import { apiPost } from '../../../../utils/request';

export default class Blink extends Component {
    blinkDevice = () => {
        apiPost('devices/' + this.props.deviceID + '/blink');
    };

    render({}, {}) {
        return (
            <Button primary onClick={this.blinkDevice}>Blink</Button>
        );
    }
}
