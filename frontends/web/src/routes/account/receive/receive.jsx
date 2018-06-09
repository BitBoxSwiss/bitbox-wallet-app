import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../../utils/request';
import { Button, Input } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import QRCode from './qrcode';
import style from './receive.css';

@translate()
export default class ReceiveButton extends Component {
    state = {
        verifying: false,
        activeIndex: null,
        receiveAddresses: null,
    }

    componentDidMount() {
        apiGet('wallet/' + this.props.code + '/receive-addresses').then(receiveAddresses => {
            this.setState({ receiveAddresses, activeIndex: 0 });
        });
    }

    verifyAddress = () => {
        this.setState({ verifying: true });
        apiPost('wallet/' + this.props.code + '/verify-address', this.state.receiveAddresses[this.state.activeIndex].scriptHashHex).then(hasSecureOutput => {
            this.setState({ verifying: false });
            if (!hasSecureOutput) {
                alert('Please pair the device to enable secure address verification. Go to the device settings.\n');
            }
        });
    }

    previous = () => {
        this.setState({ activeIndex: (this.state.activeIndex + this.state.receiveAddresses.length - 1) % this.state.receiveAddresses.length});
    };

    next = () => {
        this.setState({ activeIndex: (this.state.activeIndex + 1) % this.state.receiveAddresses.length});
    };

    render({ t, guide }, { verifying, activeIndex, receiveAddresses }) {
        const content = receiveAddresses ? (
            <div>
                <p class="label">{t('receive.label')} ({activeIndex+1}/{receiveAddresses.length})</p>
                <QRCode data={receiveAddresses[activeIndex].address} />
                <Input
                    readOnly
                    className={style.addressField}
                    onFocus={focus}
                    value={receiveAddresses[activeIndex].address} />
                <div class="buttons">
                    <Button
                        transparent
                        disabled={verifying}
                        onClick={this.previous}>
                        Previous
                    </Button>
                    <Button
                        primary
                        disabled={verifying}
                        onClick={this.verifyAddress}>
                        Verify address securely
                    </Button>
                    <Button
                        transparent
                        disabled={verifying}
                        onClick={this.next}>
                        Next
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
                        <div class="flex flex-row flex-end">
                            <Button secondary onClick={this.props.onClose}>{t('cancel')}</Button>
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
