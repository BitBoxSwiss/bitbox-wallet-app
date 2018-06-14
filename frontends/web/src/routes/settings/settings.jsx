import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../utils/request';
import { Button, Checkbox } from '../../components/forms';
import { Guide } from '../../components/guide/guide';
import Footer from '../../components/footer/footer';
import Toast from '../../components/toast/Toast';

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
        config.backend[event.target.id].active = event.target.checked;
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
                                        <div class="subHeaderContainer">
                                            <div class="subHeader">
                                                <h3>Active accounts</h3>
                                            </div>
                                        </div>
                                        <div class="flex flex-row flex-start flex-wrap wrapped">
                                            <Checkbox
                                                checked={config.backend.bitcoinP2PKH.active}
                                                id="bitcoinP2PKH"
                                                onChange={this.toggleAccountActive}
                                                label="Bitcoin Legacy"
                                                className="text-medium"
                                            />
                                            <Checkbox
                                                checked={config.backend.bitcoinP2WPKHP2SH.active}
                                                id="bitcoinP2WPKHP2SH"
                                                onChange={this.toggleAccountActive}
                                                label="Bitcoin Segwit"
                                                className="text-medium"
                                            />
                                            <Checkbox
                                                checked={config.backend.bitcoinP2WPKH.active}
                                                id="bitcoinP2WPKH"
                                                onChange={this.toggleAccountActive}
                                                label="Bitcoin Native Segwit"
                                                className="text-medium"
                                            />
                                            <Checkbox
                                                checked={config.backend.litecoinP2WPKHP2SH.active}
                                                id="litecoinP2WPKHP2SH"
                                                onChange={this.toggleAccountActive}
                                                label="Litecoin Segwit"
                                                className="text-medium"
                                            />
                                            <Checkbox
                                                checked={config.backend.litecoinP2WPKH.active}
                                                id="litecoinP2WPKH"
                                                onChange={this.toggleAccountActive}
                                                label="Litecoin Native Segwit"
                                                className="text-medium"
                                            />
                                        </div>
                                        <div class="row">
                                            <Button primary onClick={this.save}>{t('button.save')}</Button>
                                        </div>
                                    </div>
                                )
                            }
                            <Footer></Footer>
                        </div>
                    </div>
                    {
                        toast && (
                            <Toast
                                theme="success"
                                message="Settings saved. Please restart the application for the changes to take effect."
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
