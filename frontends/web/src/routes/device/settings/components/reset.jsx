import { Component } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { Button, Checkbox } from '../../../../components/forms';
import Dialog from '../../../../components/dialog/dialog';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { PasswordInput } from '../../../../components/password';
import { apiPost } from '../../../../utils/request';
import style from '../../device.css';

@translate()
export default class Reset extends Component {
    state = {
        pin: null,
        isConfirming: false,
        activeDialog: false,
        understand: false,
    }

    componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = e => {
        if (e.keyCode === 27 && !this.state.isConfirming) {
            this.abort();
        }
    }

    handleUnderstandChange = (e) => {
        this.setState({ understand: e.target.checked });
    }

    resetDevice = () => {
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/reset', { pin: this.state.pin }).then(data => {
            this.abort();
            if (data.success) {
                if (data.didReset) {
                    route('/', true);
                }
            } else if (data.errorMessage) {
                alert(data.errorMessage); // eslint-disable-line no-alert
            }
        });
    };

    setValidPIN = e => {
        this.setState({ pin: e.target.value });
    }

    abort = () => {
        this.setState({
            pin: null,
            understand: false,
            isConfirming: false,
            activeDialog: false,
        });
    }

    render({
        t
    }, {
        isConfirming,
        activeDialog,
        understand,
        pin,
    }) {
        return (
            <div>
                <Button danger onClick={() => this.setState({ activeDialog: true })}>
                    {t('reset.button')}
                </Button>
                {
                    activeDialog && (
                        <Dialog title={t('reset.title')}>
                            <p>
                                {t('reset.description')}
                            </p>
                            <PasswordInput
                                idPrefix="pin"
                                title={t('initialize.input.invalid')}
                                label={t('initialize.input.label')}
                                value={pin}
                                onInput={this.setValidPIN} />
                            <div className={style.agreements}>
                                <Checkbox
                                    id="funds_access"
                                    label={t('reset.understand')}
                                    checked={understand}
                                    onChange={this.handleUnderstandChange} />
                            </div>
                            <div className={['flex', 'flex-row', 'flex-end', 'buttons'].join(' ')}>
                                <Button secondary onClick={this.abort} disabled={isConfirming}>
                                    {t('button.back')}
                                </Button>
                                <Button danger disabled={!pin || !understand} onClick={this.resetDevice}>
                                    {t('reset.button')}
                                </Button>
                            </div>
                        </Dialog>
                    )
                }
                {
                    isConfirming && (
                        <WaitDialog
                            active={isConfirming}
                            title={t('reset.title')}
                        />
                    )
                }
            </div>
        );
    }
}
