import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../../utils/request';
import { Button, Input } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import Status from '../../../components/status/status';
import QRCode from '../../../components/qrcode/qrcode';
import style from './receive.css';

@translate()
export default class Receive extends Component {
    state = {
        verifying: false,
        activeIndex: null,
        receiveAddresses: null,
        paired: null,
    }

    componentDidMount() {
        apiGet('wallet/' + this.props.code + '/receive-addresses').then(receiveAddresses => {
            this.setState({ receiveAddresses, activeIndex: 0 });
        });
        if (this.props.deviceIDs.length > 0) {
            apiGet('devices/' + this.props.deviceIDs[0] + '/paired').then((paired) => {
                this.setState({ paired });
            });
        }
    }

    verifyAddress = () => {
        this.setState({ verifying: true });
        apiPost('wallet/' + this.props.code + '/verify-address', this.state.receiveAddresses[this.state.activeIndex].scriptHashHex).then(hasSecureOutput => {
            this.setState({ verifying: false });
            if (!hasSecureOutput) {
                /* eslint no-alert: 0 */
                alert(this.props.t('receive.warning.secureOutput'));
            }
        });
    }

    previous = () => {
        this.setState(({ activeIndex, receiveAddresses }) => ({
            activeIndex: (activeIndex + receiveAddresses.length - 1) % receiveAddresses.length
        }));
    };

    next = () => {
        this.setState(({ activeIndex, receiveAddresses }) => ({
            activeIndex: (activeIndex + 1) % receiveAddresses.length
        }));
    };

    render({
        t,
        guide,
    }, {
        verifying,
        activeIndex,
        receiveAddresses,
        paired,
    }) {
        const content = receiveAddresses ? (
            <div>
                <QRCode data={receiveAddresses[activeIndex].address} />
                <Input
                    readOnly
                    className={style.addressField}
                    onFocus={focus}
                    value={receiveAddresses[activeIndex].address} />
                <p class="label">
                    <Button
                        transparent
                        disabled={verifying}
                        onClick={this.previous}>
                        {t('button.previous')}
                    </Button>
                    {t('receive.label')}
                    ({activeIndex + 1}/{receiveAddresses.length})
                    <Button
                        transparent
                        disabled={verifying}
                        onClick={this.next}
                        className={style.button}>
                        {t('button.next')}
                    </Button>
                </p>
                <div class="buttons">
                    <Button
                        primary
                        disabled={verifying}
                        onClick={this.verifyAddress}>
                        {t('receive.verify')}
                    </Button>
                </div>
            </div>
        ) : (
            t('loading')
        );

        return (
            <div class="contentWithGuide">
                <div class="container">
                    <div class="headerContainer">
                        <Status type="warning">
                            {paired === false && t('warning.receivePairing')}
                        </Status>
                        <div class="header">
                            <h2>{t('receive.title')}</h2>
                        </div>
                    </div>
                    <div class="innerContainer">
                        <div class="content isVerticallyCentered">
                            <div class={style.receiveContent}>
                                {content}
                            </div>
                        </div>
                        <div class="flex flex-row flex-start" style="margin: 0 0 2rem 2rem;">
                            <Button secondary onClick={this.props.onClose}>
                                {t('button.back')}
                            </Button>
                        </div>
                    </div>
                </div>
                <Guide guide={guide} screen="receive" />
            </div>
        );
    }
}

function focus(e) {
    e.target.select();
}
