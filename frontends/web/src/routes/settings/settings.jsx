import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../utils/request';
import { Button, Checkbox } from '../../components/forms';
import { Guide } from '../../components/guide/guide';
import Fiat from '../../components/fiat/fiat';
import Footer from '../../components/footer/footer';
import Toast from '../../components/toast/Toast';
import style from './settings.css';

@translate()
export default class Settings extends Component {
    state = {
        toast: false,
        config: null,
    }

    componentDidMount() {
        apiGet('config').then(config => this.setState({ config }));
    }

    toggleAccountActive = event => {
        let config = this.state.config;
        config.backend[event.target.id] = event.target.checked;
        this.setState({ config });
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
        toast,
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
                                        <Fiat fiat={fiat} />
                                        <hr />
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>{t('settings.accounts')}</h3>
                                            </div>
                                        </div>
                                        <div class="flex flex-row flex-start flex-wrap wrapped">
                                            <div class={style.column}>
                                                <Checkbox
                                                    checked={config.backend.bitcoinP2WPKHP2SHActive}
                                                    id="bitcoinP2WPKHP2SHActive"
                                                    onChange={this.toggleAccountActive}
                                                    label="Bitcoin"
                                                    className="text-medium" />
                                                <Checkbox
                                                    checked={config.backend.bitcoinP2WPKHActive}
                                                    id="bitcoinP2WPKHActive"
                                                    onChange={this.toggleAccountActive}
                                                    label="Bitcoin: bech32"
                                                    className="text-medium" />
                                                <Checkbox
                                                    checked={config.backend.bitcoinP2PKHActive}
                                                    id="bitcoinP2PKHActive"
                                                    onChange={this.toggleAccountActive}
                                                    label="Bitcoin Legacy"
                                                    className="text-medium" />
                                            </div>
                                            <div class={style.column}>
                                                <Checkbox
                                                    checked={config.backend.litecoinP2WPKHP2SHActive}
                                                    id="litecoinP2WPKHP2SHActive"
                                                    onChange={this.toggleAccountActive}
                                                    label="Litecoin"
                                                    className="text-medium" />
                                                <Checkbox
                                                    checked={config.backend.litecoinP2WPKHActive}
                                                    id="litecoinP2WPKHActive"
                                                    onChange={this.toggleAccountActive}
                                                    label="Litecoin: bech32"
                                                    className="text-medium" />
                                            </div>
                                        </div>
                                        <div class="row">
                                            <Button primary onClick={this.save}>
                                                {t('button.save')}
                                            </Button>
                                        </div>
                                    </div>
                                )
                            }
                            <Footer />
                        </div>
                    </div>
                    {
                        toast && (
                            <Toast
                                theme="success"
                                message={t('settings.success')}
                                withGuide={guide.shown}
                                onHide={() => this.setState({ toast: false })}
                            />
                        )
                    }
                </div>
                <Guide guide={guide} screen="settings" />
            </div>
        );
    }
}
