/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { route } from '../../utils/route';
import { alertUser } from '../../components/alert/Alert';
import { Badge } from '../../components/badge/badge';
import { Skeleton } from '../../components/skeleton/skeleton';
import { Dialog, DialogButtons } from '../../components/dialog/dialog';
import { Button, Input } from '../../components/forms';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import { updateRatesConfig } from '../../components/rates/rates';
import { SwissMadeOpenSource, SwissMadeOpenSourceDark } from '../../components/icon/logo';
import InlineMessage from '../../components/inlineMessage/InlineMessage';
import { Footer, Header } from '../../components/layout';
import { SettingsButton } from '../../components/settingsButton/settingsButton';
import { SettingsItem } from '../../components/settingsButton/settingsItem';
import { Toggle } from '../../components/toggle/toggle';
import { Checked, RedDot } from '../../components/icon/icon';
import { translate, TranslateProps } from '../../decorators/translate';
import { setConfig } from '../../utils/config';
import { apiGet, apiPost } from '../../utils/request';
import { setBtcUnit, BtcUnit } from '../../api/coins';
import { TUpdateFile, getVersion, getUpdate } from '../../api/version';
import { FiatSelection } from './components/fiat/fiat';
import { downloadLinkByLanguage } from '../../components/appdownloadlink/appdownloadlink';
import { DarkModeToggle } from '../../components/darkmode/darkmodetoggle';
import { SettingsToggle } from '../../components/settingsButton/settingsToggle';

interface SettingsProps {
    manageAccountsLen: number;
    deviceIDs: string[];
}

type Props = SettingsProps & TranslateProps;

interface State {
    restart: boolean;
    config: any;
    proxyAddress?: string;
    activeProxyDialog: boolean;
    version?: string;
    update?: TUpdateFile | null;
}

class Settings extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      restart: false,
      config: null,
      proxyAddress: undefined,
      activeProxyDialog: false,
      version: undefined,
      update: undefined
    };
  }

  public componentDidMount() {
    apiGet('config').then(config => {
      this.setState({ config, proxyAddress: config.backend.proxy.proxyAddress });
    });
    getVersion().then(version => this.setState({ version }));
    getUpdate().then(update => this.setState({ update }));
  }

  public componentDidUpdate(prevProps: Props) {
    if (prevProps.deviceIDs.length && !this.props.deviceIDs.length) {
      route('/', true);
    }
  }

  private handleToggleFrontendSetting = (event: React.SyntheticEvent) => {
    const target = (event.target as HTMLInputElement);
    setConfig({
      frontend: {
        [target.id]: target.checked,
      },
    })
      .then(config => this.setState({ config }));
  };

  private handleFormChange = (event: React.SyntheticEvent) => {
    const target = (event.target as HTMLInputElement);
    if (target.name !== 'proxyAddress') {
      return;
    }
    this.setState({
      [target.name]: target.value,
      restart: false,
    });
  };

  private setProxyConfig = (proxyConfig: any) => {
    setConfig({
      backend: { proxy: proxyConfig },
    }).then(config => {
      this.setState({
        config,
        proxyAddress: proxyConfig.proxyAddress,
        restart: true,
      });
    });
  };

  private handleToggleProxy = (event: React.SyntheticEvent) => {
    const config = this.state.config;
    if (!config) {
      return;
    }
    const target = (event.target as HTMLInputElement);
    const proxy = config.backend.proxy;
    proxy.useProxy = target.checked;
    this.setProxyConfig(proxy);
  };

  private handleToggleSatsUnit = (event: React.SyntheticEvent) => {
    const config = this.state.config;
    if (!config) {
      return;
    }
    const target = (event.target as HTMLInputElement);
    var unit: BtcUnit = 'default';
    if (target.checked) {
      unit = 'sat';
    }

    setConfig({
      backend: { btcUnit: unit }
    }).then(config => {
      this.setState({ config });
      updateRatesConfig();
    });
    setBtcUnit(unit).then(result => {
      if (!result.success) {
        alertUser(this.props.t('genericError'));
      }
    });
  };

  private setProxyAddress = () => {
    const config = this.state.config;
    if (!config || this.state.proxyAddress === undefined) {
      return;
    }
    const proxy = config.backend.proxy;
    proxy.proxyAddress = this.state.proxyAddress.trim();
    apiPost('socksproxy/check', proxy.proxyAddress).then(({ success, errorMessage }) => {
      if (success) {
        this.setProxyConfig(proxy);
      } else {
        alertUser(errorMessage);
      }
    });
  };

  private showProxyDialog = () => {
    this.setState({ activeProxyDialog: true });
  };

  private hideProxyDialog = () => {
    this.setState({ activeProxyDialog: false });
  };

  private handleRestartDismissMessage = () => {
    this.setState({ restart: false });
  };

  public render() {
    const {
      manageAccountsLen,
      deviceIDs,
      t,
    } = this.props;
    const {
      config,
      restart,
      proxyAddress,
      activeProxyDialog,
      version,
      update
    } = this.state;
    if (proxyAddress === undefined) {
      return null;
    }

    return (
      <div className="contentWithGuide">
        <div className="container">
          <div className="innerContainer scrollableContainer">
            <Header title={<h2>{t('settings.title')}</h2>}>
              {
                !deviceIDs.length && (
                  <Link to="/" className="flex flex-row flex-items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="m-right-tiny">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                    {t('settings.header.home')}
                  </Link>
                )
              }
            </Header>
            <div className="content padded">
              {
                config && (
                  <div className="flex-1">
                    <div className="columnsContainer">
                      <div className="columns">
                        <div className="column column-1-3">
                          <FiatSelection />
                        </div>
                        <div className="column column-2-3">
                          <div>
                            <h3 className="subTitle">{t('settings.info.title')}</h3>
                            <div className="box slim divide m-bottom-large">
                              { version !== undefined && update !== undefined ? (
                                update ? (
                                  <SettingsButton
                                    optionalText={version}
                                    secondaryText={
                                      <>
                                        {t('settings.info.out-of-date')}
                                        {' '}
                                        <RedDot />
                                      </>
                                    }
                                    disabled={false}
                                    onClick={() => update && apiPost('open', downloadLinkByLanguage())}>
                                    {t('settings.info.version')}
                                  </SettingsButton>
                                ) : (
                                  <SettingsItem
                                    optionalText={version}
                                    optionalIcon={<Checked/>}>
                                    {t('settings.info.up-to-date')}
                                  </SettingsItem>
                                )
                              ) : <Skeleton fontSize="var(--item-height)" />}
                              <DarkModeToggle />
                            </div>
                          </div>
                          { manageAccountsLen ? (
                            <div>
                              <h3 className="subTitle">Accounts</h3>
                              <div className="box slim divide m-bottom-large">
                                <SettingsButton
                                  onClick={() => route('/settings/manage-accounts', true)}
                                  secondaryText={t('manageAccounts.settingsButtonDescription')}
                                  optionalText={manageAccountsLen.toString()}>
                                  {t('manageAccounts.title')}
                                </SettingsButton>
                              </div>
                            </div>
                          ) : null}
                          <h3 className="subTitle">{t('settings.expert.title')}</h3>
                          <div className="box slim divide m-bottom-large">
                            <SettingsToggle
                              checked={config.frontend.expertFee}
                              id="expertFee"
                              onChange={this.handleToggleFrontendSetting}>
                              {t('settings.expert.fee')}
                            </SettingsToggle>
                            <SettingsToggle
                              checked={config.frontend.coinControl}
                              id="coinControl"
                              onChange={this.handleToggleFrontendSetting}>
                              <div>
                                <p className="m-none">{t('settings.expert.coinControl')}</p>
                                <p className="m-none">
                                  <Badge type="generic">BTC</Badge>
                                  <Badge type="generic" className="m-left-quarter">LTC</Badge>
                                </p>
                              </div>
                            </SettingsToggle>
                            <SettingsToggle
                              checked={config.backend.btcUnit === 'sat'}
                              id="satsUnit"
                              onChange={this.handleToggleSatsUnit}>
                              {t('settings.expert.useSats')}
                            </SettingsToggle>
                            <SettingsButton
                              onClick={this.showProxyDialog}
                              optionalText={t('generic.enabled', { context: config.backend.proxy.useProxy.toString() })}>
                              {t('settings.expert.useProxy')}
                            </SettingsButton>
                            <Dialog open={activeProxyDialog} onClose={this.hideProxyDialog} title={t('settings.expert.setProxyAddress')} small>
                              <div className="flex flex-row flex-between flex-items-center">
                                <div>
                                  <p className="m-none">{t('settings.expert.useProxy')}</p>
                                </div>
                                <Toggle
                                  id="useProxy"
                                  checked={config.backend.proxy.useProxy}
                                  onChange={this.handleToggleProxy} />
                              </div>
                              <div className="m-top-half">
                                <Input
                                  name="proxyAddress"
                                  onInput={this.handleFormChange}
                                  value={proxyAddress}
                                  placeholder="127.0.0.1:9050"
                                  disabled={!config.backend.proxy.useProxy}
                                />
                                <DialogButtons>
                                  <Button primary
                                    onClick={this.setProxyAddress}
                                    disabled={!config.backend.proxy.useProxy || proxyAddress === config.backend.proxy.proxyAddress}>
                                    {t('settings.expert.setProxyAddress')}
                                  </Button>
                                </DialogButtons>
                              </div>
                            </Dialog>
                            <SettingsButton onClick={() => route('/settings/electrum', true)}>
                              {t('settings.expert.electrum.title')}
                            </SettingsButton>
                          </div>
                        </div>
                      </div>
                      {
                        restart && (
                          <div className="row">
                            <InlineMessage
                              type="success"
                              align="left"
                              message={t('settings.restart')}
                              onEnd={this.handleRestartDismissMessage} />
                          </div>
                        )
                      }
                    </div>
                  </div>
                )
              }
            </div>
            <Footer>
              <SwissMadeOpenSource className="show-in-lightmode" />
              <SwissMadeOpenSourceDark className="show-in-darkmode" />
            </Footer>
          </div>
        </div>
        <Guide>
          <Entry key="guide.settings.sats" entry={t('guide.settings.sats')} />
          <Entry key="guide.accountRates" entry={{
            link: {
              text: 'www.coingecko.com',
              url: 'https://www.coingecko.com/'
            },
            text: t('guide.accountRates.text'),
            title: t('guide.accountRates.title')
          }} />
          <Entry key="guide.settings.servers" entry={t('guide.settings.servers')} />
          <Entry key="guide.settings-electrum.why" entry={t('guide.settings-electrum.why')} />
          <Entry key="guide.settings-electrum.tor" entry={t('guide.settings-electrum.tor')} />
        </Guide>
      </div>
    );
  }
}

const HOC = translate()(Settings);
export { HOC as Settings };
