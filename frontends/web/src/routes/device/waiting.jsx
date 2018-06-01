import { Component, h } from 'preact';
import i18n from '../../i18n/i18n';

import { apiPost } from '../../utils/request';
import { Button, Input } from '../../components/forms';
import { BitBox, Shift } from '../../components/icon/logo';
import { Guide, Entry } from '../../components/guide/guide';
import Footer from '../../components/footer/footer';
import { debug } from '../../utils/env';
import style from './device.css';

export default function Waiting({ testing, guide }) {
    return (
        <div class="contentWithGuide">
            <div className={style.container}>
                <BitBox />
                <div className={style.content}>
                    <h3 style="text-align: center;">{i18n.t('device.waiting')}</h3>
                    <SkipForTestingButton show={debug && testing} />
                    <hr />
                    <Footer>
                        <Shift style="max-width: 100px; margin: auto auto auto 0;" />
                    </Footer>
                </div>
            </div>
            <Guide guide={guide} screen="waiting">
                <Entry title={i18n.t('guide.waitingWithoutDevice.title')}>
                    {!(debug && testing) && <p>{i18n.t('guide.waitingWithoutDevice.text.0')}</p>}
                    {debug && testing && <p>{i18n.t('guide.waitingWithoutDevice.text.1')}</p>}
                </Entry>
            </Guide>
        </div>
    );
}

class SkipForTestingButton extends Component {
    state = {
        testPIN: ''
    }

    registerTestingDevice = (e) => {
        apiPost('test/register', { pin: this.state.testPIN });
        e.preventDefault();
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
