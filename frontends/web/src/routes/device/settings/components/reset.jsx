import { Component } from 'preact';
import { route } from 'preact-router';
import { translate } from 'react-i18next';
import { Button } from '../../../../components/forms';
import Dialog from '../../../../components/dialog/dialog';
import WaitDialog from '../../../../components/wait-dialog/wait-dialog';
import { apiPost } from '../../../../utils/request';

@translate()
export default class Reset extends Component {
    state = {
        isConfirming: false,
        activeDialog: false,
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
    }) {
        return (
            <div>
                <Button danger onClick={() => this.setState({ activeDialog: true })}>
                    {t('reset.button')}
                </Button>
                {
                    activeDialog && (
                        <Dialog title={t('reset.title')}>
                            <p>{t('reset.description')}</p>
                            <div class={['flex', 'flex-row', 'flex-end', 'buttons'].join(' ')}>
                                <Button secondary onClick={() => this.setState({ activeDialog: false })}>
                                    {t('button.back')}
                                </Button>
                                <Button danger onClick={this.resetDevice}>
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
