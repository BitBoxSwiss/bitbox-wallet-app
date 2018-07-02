import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../utils/request';
import { Button, Checkbox } from '../../components/forms';
import { Guide } from '../../components/guide/guide';
import Fiat from '../../components/fiat/fiat';
import Footer from '../../components/footer/footer';
import InlineMessage from '../../components/inlineMessage/InlineMessage';
import style from './settings.css';

@translate()
export default class Settings extends Component {
    state = {
        fiatSuccess: false,
        accountSuccess: false,
        config: null,
    }

    componentDidMount() {
        apiGet('config').then(config => this.setState({ config }));
    }

    toggleAccountActive = event => {
        let config = this.state.config;
        if (!config) return;
        config.backend[event.target.id] = event.target.checked;
        apiPost('config', config).then(() => {
            this.setState({
                config,
                accountSuccess: true,
            });
        });
    }

    save = event => {
        if (!this.state.config) {
            return;
        }
        apiPost('config', this.state.config).then(() => {
            this.setState({ toast: true });
        });
    }

    render({
        t,
        guide,
        fiat,
    }, {
        config,
        fiatSuccess,
        accountSuccess,
    }) {
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <div class="headerContainer">
                        <div class="header">
                            <h2>{t('settings.title')}</h2>
                        </div>
                    </div>
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            {
                                config && (
                                    <div class="flex-1">
                                        <Fiat
                                            fiat={fiat}
                                            onChange={() => this.setState({ fiatSuccess: true })}
                                        />
                                        {
                                            fiatSuccess && (
                                                <div class="row">
                                                    <InlineMessage
                                                        type="success"
                                                        align="left"
                                                        message={t('fiat.success')}
                                                        onEnd={() => this.setState({ fiatSuccess: false })}
                                                    />
                                                </div>
                                            )
                                        }
                                        <hr />
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('settings.accounts.title')}</h3>
                                            </div>
                                        </div>
                                        <div class="flex flex-row flex-start flex-wrap wrapped">
                                            <div class={style.column}>
                                                <Checkbox
                                                    checked={config.backend.bitcoinP2WPKHP2SHActive}
                                                    id="bitcoinP2WPKHP2SHActive"
                                                    onChange={this.toggleAccountActive}
                                                    label={t('settings.accounts.bitcoinP2WPKHP2SH')}
                                                    className="text-medium" />
                                                <Checkbox
                                                    checked={config.backend.bitcoinP2WPKHActive}
                                                    id="bitcoinP2WPKHActive"
                                                    onChange={this.toggleAccountActive}
                                                    label={t('settings.accounts.bitcoinP2WPKH')}
                                                    className="text-medium" />
                                                <Checkbox
                                                    checked={config.backend.bitcoinP2PKHActive}
                                                    id="bitcoinP2PKHActive"
                                                    onChange={this.toggleAccountActive}
                                                    label={t('settings.accounts.bitcoinP2PKH')}
                                                    className="text-medium" />
                                            </div>
                                            <div class={style.column}>
                                                <Checkbox
                                                    checked={config.backend.litecoinP2WPKHP2SHActive}
                                                    id="litecoinP2WPKHP2SHActive"
                                                    onChange={this.toggleAccountActive}
                                                    label={t('settings.accounts.litecoinP2WPKHP2SH')}
                                                    className="text-medium" />
                                                <Checkbox
                                                    checked={config.backend.litecoinP2WPKHActive}
                                                    id="litecoinP2WPKHActive"
                                                    onChange={this.toggleAccountActive}
                                                    label={t('settings.accounts.litecoinP2WPKH')}
                                                    className="text-medium" />
                                            </div>
                                        </div>
                                        {
                                            accountSuccess && (
                                                <div class="row">
                                                    <InlineMessage
                                                        type="success"
                                                        align="left"
                                                        message={t('settings.success')}
                                                        onEnd={() => this.setState({ accountSuccess: false })}
                                                    />
                                                </div>
                                            )
                                        }
                                    </div>
                                )
                            }
                            <Footer />
                        </div>
                    </div>
                </div>
                <Guide guide={guide} screen="settings" />
            </div>
        );
    }
}
