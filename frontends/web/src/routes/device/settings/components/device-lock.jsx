import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../../../../components/forms';
import Dialog from '../../../../components/dialog/dialog';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { apiPost } from '../../../../utils/request';

@translate()
export default class DeviveLock extends Component {
    state = {
        isConfirming: false,
        activeDialog: false,
    }

    resetDevice = () => {
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost('devices/' + this.props.deviceID + '/lock').then(({ didLock }) => {
            this.setState({
                isConfirming: false,
            });
        });
    };

    render({
        t,
        disabled,
    }, {
        isConfirming,
        activeDialog,
    }) {
        return (
            <div>
                <Button danger onClick={() => this.setState({ activeDialog: true })} disabled={disabled}>
                    {t('deviceLock.button')}
                </Button>
                {
                    activeDialog && (
                        <Dialog title={t('deviceLock.title')}>
                            <p>{t('deviceLock.condition1')}</p>
                            <p>{t('deviceLock.condition2')}</p>
                            <p>{t('deviceLock.condition3')}</p>
                            <div class={['flex', 'flex-row', 'flex-end', 'buttons'].join(' ')}>
                                <Button secondary onClick={() => this.setState({ activeDialog: false })}>
                                    {t('button.back')}
                                </Button>
                                <Button danger onClick={this.resetDevice}>
                                    {t('deviceLock.confirm')}
                                </Button>
                            </div>
                        </Dialog>
                    )
                }
                {
                    isConfirming && (
                        <WaitDialog title={t('deviceLock.title')} />
                    )
                }
            </div>
        );
    }
}
