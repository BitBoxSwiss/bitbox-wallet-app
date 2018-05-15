import { Component, h } from 'preact';
import i18n from '../../i18n/i18n';

import { apiPost } from '../../utils/request';
import { Button, Input } from '../../components/forms';
import { BitBox } from '../../components/icon/logo';
import { debug } from '../../utils/env';
import style from './device.css';


export default function Waiting({ testing }) {
    return (
        <div className={style.container}>
            {BitBox}
            <div className={style.content}>
                <h3 style="text-align: center;">{i18n.t('device.waiting')}</h3>
                <SkipForTestingButton show={debug && testing} />
            </div>
        </div>
    );
}

class SkipForTestingButton extends Component {
    constructor(props) {
        super(props);
        this.state = {
            testPIN: ''
        };
    }

    registerTestingDevice = () => {
        apiPost('test/register', { pin: this.state.testPIN });
    }

    handleFormChange = event => {
        this.setState({ [event.target.id]: event.target.value });
    };

    render({ show }, { testPIN }) {
        if (!show) {
            return null;
        }
        return (
            <form onSubmit={this.registerTestingDevice}>
                <Input
                    type="password"
                    autoFocus
                    id="testPIN"
                    label="Test PIN"
                    onInput={this.handleFormChange}
                    value={testPIN} />
                <Button type="submit" secondary>
                    Skip for Testing
                </Button>
            </form>
        );
    }
}
