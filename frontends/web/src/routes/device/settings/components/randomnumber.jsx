import { Component } from 'preact';
import i18n from '../../../../i18n/i18n';
import { Button } from '../../../../components/forms';
import { apiPost } from '../../../../utils/request';

export default class RandomNumber extends Component {
    getRandomNumber = () => {
        apiPost('devices/' + this.props.deviceID + '/random-number').then(num => {
            alert(i18n.t('random.description') + '\n' + num); // eslint-disable-line no-alert
        });
    };

    render({}, {}) {
        return (
            <Button primary onClick={this.getRandomNumber}>
                {i18n.t('random.button')}
            </Button>
        );
    }
}
