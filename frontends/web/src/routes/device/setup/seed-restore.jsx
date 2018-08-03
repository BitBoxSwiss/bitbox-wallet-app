import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet } from '../../../utils/request';
import { Button } from '../../../components/forms';
import Backups from '../../../components/backups/backups';
import Message from '../../../components/message/message';
import { BitBox, Shift } from '../../../components/icon/logo';
import { Guide } from '../../../components/guide/guide';
import Footer from '../../../components/footer/footer';
import Spinner from '../../../components/spinner/Spinner';
import { Steps, Step } from './components/steps';
import style from '../device.css';

const STATUS = Object.freeze({
    DEFAULT: 'default',
    WAITING: 'waiting',
    ERROR: 'error',
});

@translate()
export default class SeedRestore extends Component {
    state = {
        showInfo: true,
        status: STATUS.DEFAULT,
        error: '',
    }

    componentDidMount () {
        this.checkSDcard();
    }

    displayError = error => {
        this.setState({
            status: STATUS.ERROR,
            error,
        });
    }

    checkSDcard = () => {
        apiGet('devices/' + this.props.deviceID + '/info').then(({ sdcard }) => {
            if (sdcard) {
                return this.setState({ status: STATUS.DEFAULT, error: '' });
            }
            this.setState({
                status: STATUS.ERROR,
                error: this.props.t('seed.error.200'),
            });
            setTimeout(this.checkSDcard, 2500);
        });
    }

    handleStart = () => {
        this.setState({ showInfo: false });
        this.checkSDcard();
    }

    render({
        t,
        deviceID,
        guide,
        goBack,
    }, {
        showInfo,
        status,
        error,
    }) {
        return (
            <div class="contentWithGuide">
                <div className={[style.container, style.scrollable].join(' ')}>
                    <div className={style.content}>
                        <h1 className={style.title}>Restore wallet</h1>
                        <Steps current={2}>
                            <Step title={t('goal.step.1.title')} description={t('goal.step.1.description')} />
                            <Step title={t('goal.step.2.title')} description={t('goal.step.2.description')} />
                            <Step title={t(`goal.step.3_restore.title`)} description={t(`goal.step.3_restore.description`)} />
                            <Step title={t(`goal.step.4_restore.title`)} description={t(`goal.step.4_restore.description`)} />
                        </Steps>
                        <Message type={status === STATUS.ERROR && 'error'}>
                            { error }
                        </Message>
                        {showInfo ? (
                            <div>
                                <h2>{t('backup.info.title')}</h2>
                                <p>{t('backup.info.description')}</p>
                                <div className="buttons buttons-end">
                                    <Button
                                        transparent
                                        onClick={goBack}>
                                        {t('button.back')}
                                    </Button>
                                    <Button primary onClick={this.handleStart}>
                                        {t('backup.info.button')}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Backups
                                showCreate={false}
                                displayError={this.displayError}
                                deviceID={deviceID}
                                requireConfirmation={false}>
                                <Button
                                    transparent
                                    onClick={goBack}>
                                    {t('button.back')}
                                </Button>
                            </Backups>
                        )}
                        <hr />
                        <Footer>
                            <Shift />
                        </Footer>
                    </div>
                    {
                        status === STATUS.WAITING && (
                            <Spinner text={t('seed.creating')} showLogo />
                        )
                    }
                </div>
                <Guide guide={guide} screen="seed" />
            </div>
        );
    }
}
