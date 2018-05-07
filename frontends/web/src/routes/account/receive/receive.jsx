import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet } from '../../../utils/request';
import { Button, Input } from '../../../components/forms';
import QRCode from './qrcode';
import style from './receive.css';

@translate()
export default class ReceiveButton extends Component {
    state = {
        receiveAddress: null
    }

    componentDidMount() {
        apiGet('wallet/' + this.props.code + '/receive-address').then(receiveAddress => {
            this.setState({ receiveAddress });
        });
    }

    render({ t }, { receiveAddress }) {
        const content = receiveAddress ? (
            <div>
                <p class="label">{t('receive.label')}</p>
                <QRCode data={receiveAddress} />
                <Input
                    readOnly
                    className={style.addressField}
                    onFocus={focus}
                    value={receiveAddress} />
            </div>
        ) : (
            t('loading')
        );

        return (
            <div class="innerContainer">
                <div class="header">
                    <h2>{t('receive.title')}</h2>
                </div>
                <div class="content isVerticallyCentered">
                    <div class={style.receiveContent}>
                        {content}
                    </div>
                </div>
                <div class="flex flex-row flex-end">
                    <Button primary onClick={this.props.onClose}>{t('cancel')}</Button>
                </div>
            </div>
        );
    }
}

function focus(e) {
    e.target.select();
}
