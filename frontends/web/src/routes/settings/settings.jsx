import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet, apiPost } from '../../utils/request';
import { Button, Checkbox } from '../../components/forms';
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
    }, {
        config,
        toast,
    }) {
        return (
            <div class="container">
                <div class="headerContainer">
                    <div class="header">
                        <h2>{t('settings.title')}</h2>
                    </div>
                </div>
                <div class="innerContainer">
                    <div class="content flex flex-column flex-start">
                        {
                            config && (
                                <div>
                                    <div class="subHeaderContainer">
                                        <div class="subHeader">
                                            <h3>Active accounts</h3>
                                        </div>
                                    </div>
                                    <Checkbox
                                        checked={config.backend.bitcoinP2PKHActive}
                                        id="bitcoinP2PKHActive"
                                        onChange={this.toggleAccountActive}
                                        label="Bitcoin Legacy"
                                        className="text-medium"
                                    />
                                    <Checkbox
                                        checked={config.backend.bitcoinP2WPKHP2SHActive}
                                        id="bitcoinP2WPKHP2SHActive"
                                        onChange={this.toggleAccountActive}
                                        label="Bitcoin Segwit"
                                        className="text-medium"
                                    />
                                    <Checkbox
                                        checked={config.backend.bitcoinP2WPKHActive}
                                        id="bitcoinP2WPKHActive"
                                        onChange={this.toggleAccountActive}
                                        label="Bitcoin Native Segwit"
                                        className="text-medium"
                                    />
                                    <Checkbox
                                        checked={config.backend.litecoinP2WPKHP2SHActive}
                                        id="litecoinP2WPKHP2SHActive"
                                        onChange={this.toggleAccountActive}
                                        label="Litecoin Segwit"
                                        className="text-medium"
                                    />
                                    <Checkbox
                                        checked={config.backend.litecoinP2WPKHActive}
                                        id="litecoinP2WPKHActive"
                                        onChange={this.toggleAccountActive}
                                        label="Litecoin Native Segwit"
                                        className="text-medium"
                                    />
                                </div>
                            )
                        }
                    </div>
                    <div class="content flex-none flex flex-row flex-end">
                        <Button primary onClick={this.save}>{t('button.save')}</Button>
                    </div>
                </div>
                <Toast
                    trigger={toast}
                    theme="success"
                    message="Settings saved. Please restart the application for the changes to take effect."
                    onHide={() => this.setState({ toast: false })}
                />
            </div>
        );
    }
}
