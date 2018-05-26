import { Component } from 'preact';
import { Button } from '../../../../components/forms';
import { apiPost } from '../../../../utils/request';

export default class RandomNumber extends Component {
    getRandomNumber = () => {
        apiPost('devices/' + this.props.deviceID + '/random-number').then(num => {
            const description = 'Your BitBox generated the following 128 bit random number:';
            alert(description + '\n\n\n' + num);
        });
    };

    render({}, {}) {
        return (
            <Button primary onClick={this.getRandomNumber}>Generate Random Number</Button>
        );
    }
}
