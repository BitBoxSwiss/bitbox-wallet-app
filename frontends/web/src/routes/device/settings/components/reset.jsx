import { Component } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { Button, Checkbox } from '../../../../components/forms';
import Dialog from '../../../../components/dialog/dialog';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { apiPost } from '../../../../utils/request';
import style from '../../device.css';

@translate()
export default class Reset extends Component {
    state = {
        isConfirming: false,
        activeDialog: false,
        understand: false,
    }

    handleUnderstandChange = (e) => {
        this.setState({ understand: e.target.checked });
    }

    resetDevice = () => {
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/reset').then(({ didReset }) => {
            this.setState({
                isConfirming: false,
            });
            if (didReset) {
                route('/', true);
            }
        });
    };

    render({
        t
    }, {
        isConfirming,
        activeDialog,
        understand,
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
                            <div className={style.agreements}>
                                <Checkbox
                                    id="funds_access"
                                    label={t('reset.understand')}
                                    onChange={this.handleUnderstandChange} />
                            </div>
                            <div className={['flex', 'flex-row', 'flex-end', 'buttons'].join(' ')}>
                                <Button secondary onClick={() => this.setState({ activeDialog: false })}>
                                    {t('button.back')}
                                </Button>
                                <Button danger disabled={!understand} onClick={this.resetDevice}>
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
