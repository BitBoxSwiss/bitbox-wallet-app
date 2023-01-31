/**
 * Copyright 2018 Shift Devices AG
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

import { Component } from 'react';
import { apiWebsocket, TPayload } from '../../../../../utils/websocket';
import appStoreBadge from '../../../../../assets/badges/app-store-badge.svg';
import playStoreBadge from '../../../../../assets/badges/google-play-badge.png';
import { alertUser } from '../../../../../components/alert/Alert';
import { confirmation } from '../../../../../components/confirm/Confirm';
import { DialogLegacy, DialogButtons } from '../../../../../components/dialog/dialog-legacy';
import { Button } from '../../../../../components/forms';
import { QRCode } from '../../../../../components/qrcode/qrcode';
import { SettingsButton } from '../../../../../components/settingsButton/settingsButton';
import { translate, TranslateProps } from '../../../../../decorators/translate';
import { apiPost } from '../../../../../utils/request';
import style from '../../bitbox01.module.css';

interface PairingProps {
    deviceID: string;
    deviceLocked: boolean;
    paired: boolean;
    hasMobileChannel: boolean;
    onPairingEnabled: () => void;
}

type Props = PairingProps & TranslateProps;

interface State {
    channel: string | null;
    status: string | boolean;
    showQRCode: boolean;
}

class MobilePairing extends Component<Props, State> {
  private unsubscribe: (() => void) | undefined;

  constructor(props: Props) {
    super(props);
    this.state = {
      channel: null,
      status: false,
      showQRCode: false,
    };
  }

  public componentDidMount() {
    this.unsubscribe = apiWebsocket(this.onDeviceStatus);
  }

  public componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private onDeviceStatus = (payload: TPayload) => {
    if ('type' in payload) {
      const { type, data, deviceID } = payload;
      if (type === 'device' && deviceID === this.props.deviceID) {
        switch (data) {
        case 'pairingStarted':
          this.setState({ status: 'started' });
          break;
        case 'pairingTimedout':
          if (this.state.status) {
            this.setState({ status: 'timeout' });
          }
          break;
        case 'pairingPullMessageFailed':
          this.setState({ status: 'pullFailed' });
          break;
        case 'pairingScanningFailed':
          this.setState({ status: 'scanningFailed' });
          break;
        case 'pairingAborted':
          this.setState({ status: 'aborted' });
          break;
        case 'pairingError':
          this.setState({ status: 'error' });
          break;
        case 'pairingSuccess':
          this.setState({ status: 'success' });
          break;
        }
      }
    }
  };

  private reconnectUnpaired = () => {
    // If a mobile connection exists, but the device is not marked as paired, then mark it as paired.
    confirmation(this.props.t('pairing.confirm'), response => {
      if (!response) {
        return;
      }
      apiPost('devices/' + this.props.deviceID + '/feature-set', {
        pairing: true,
      }).then(() => {
        this.props.onPairingEnabled();
        alertUser(this.props.t('pairing.success.text'));
      });
    });
  };

  private startPairing = () => {
    confirmation(this.props.t('pairing.confirm'), response => {
      if (!response) {
        return;
      }
      this.setState({
        channel: null,
        status: 'loading',
      });
      apiPost('devices/' + this.props.deviceID + '/pairing/start').then(channel => {
        if (this.props.deviceLocked) {
          this.setState({
            channel,
            status: 'connectOnly',
          });
        } else {
          this.setState({
            channel,
            status: 'start',
          });
        }
      });
    });
  };

  private abort = () => {
    this.setState({
      showQRCode: false,
      status: false,
    });
  };

  private toggleQRCode = () => {
    this.setState({ showQRCode: !this.state.showQRCode });
  };

  public render() {
    const { t, deviceLocked, paired, hasMobileChannel } = this.props;
    const { channel, status, showQRCode } = this.state;
    let content;
    if (status === 'start') {
      content = (
        <div>
          <div className="flex flex-row flex-start">
            <div>
              <p className="m-top-none"><strong className="m-right-quarter">1.</strong> {t('pairing.start.step1')}</p>
              <p>
                <Button primary onClick={this.toggleQRCode} className="width-1-1">
                  {t(`pairing.start.${showQRCode ? 'hideAppQRCode' : 'revealAppQRCode'}`)}
                </Button>
              </p>
              {
                showQRCode ? (
                  <div className="columnsContainer m-top-default">
                    <div className="columns">
                      <div className="column column-1-2">
                        <label className="text-center">Apple App Store</label>
                        <div className="flex flex-column flex-center flex-items-center">
                          <QRCode data="https://itunes.apple.com/us/app/digital-bitbox-2fa/id1079896740" size={148} />
                          <a target="_blank" rel="noreferrer" href="https://itunes.apple.com/us/app/digital-bitbox-2fa/id1079896740"><img src={appStoreBadge} className={style.badge} /></a>
                        </div>
                      </div>
                      <div className="column column-1-2">
                        <label className="text-center">Google Play Store</label>
                        <div className="flex flex-column flex-center flex-items-center">
                          <QRCode data="https://play.google.com/store/apps/details?id=com.digitalbitbox.tfa" size={148} />
                          <a target="_blank" rel="noreferrer" href="https://play.google.com/store/apps/details?id=com.digitalbitbox.tfa"><img src={playStoreBadge} className={style.badge} /></a>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null
              }
            </div>
          </div>
          <div className="flex flex-row flex-start m-top-default">
            <div>
              <p className="m-top-none"><strong className="m-right-quarter">2.</strong>{t('pairing.start.step2')}</p>
              <div className="text-center">
                <QRCode data={JSON.stringify(channel)} size={196} />
              </div>
            </div>
          </div>
        </div>
      );
    } else if (status === 'connectOnly') {
      content = (<QRCode data={JSON.stringify({ channel, connectOnly: true })} />);
    } else {
      content = (<p className="m-top-none">{t(`pairing.${status}.text`)}</p>);
    }
    return (
      <div>
        <SettingsButton
          onClick={hasMobileChannel && !paired ? this.reconnectUnpaired : this.startPairing}
          optionalText={t(`deviceSettings.pairing.status.${paired}`)}>
          { deviceLocked ? (
            hasMobileChannel ? t('pairing.reconnectOnly.button') : t('pairing.connectOnly.button')
          ) : (
            (hasMobileChannel && !paired) ? t('pairing.reconnectOnly.button') : t('pairing.button')
          )}
        </SettingsButton>
        {
          status && (
            <DialogLegacy
              title={t('pairing.title')}
              onClose={this.abort}
              medium>
              <div className="flex flex-column flex-center flex-items-center">
                {
                  channel ? (
                    content
                  ) : (
                    <p>{t('loading')}</p>
                  )
                }
              </div>
              <DialogButtons>
                <Button transparent onClick={this.abort}>
                  {t('button.back')}
                </Button>
              </DialogButtons>
            </DialogLegacy>
          )
        }
      </div>
    );
  }
}

const translatedMobilePairing = translate()(MobilePairing);
export { translatedMobilePairing as MobilePairing };
