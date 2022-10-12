/**
 * Copyright 2022 Shift Crypto AG
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
import { withTranslation } from 'react-i18next';
import { Button, Input } from '../../components/forms';
import { apiPost } from '../../utils/request';
import { alertUser } from '../../components/alert/Alert';
import style from './electrum.module.css';

class ElectrumServerClass extends Component {
  state = {
    valid: false,
    electrumServer: '',
    electrumCert: '',
    tls: false,
    loadingCheck: false,
    loadingCert: false,
  };

  componentDidMount() {
    if (this.props.server !== null) {
      this.setState({
        electrumServer: this.props.server.server,
        electrumCert: this.props.server.pemCert,
        tls: this.props.server.tls,
      });
    }
  }

  isTLS = () => {
    if (this.props.server === null) { // in add-mode
      return this.state.electrumCert !== '';
    }
    // in list-mode
    return this.props.server.tls;
  };

  handleFormChange = event => {
    this.setState({
      [event.target.name]: event.target.value,
      valid: false
    });
  };

  getServer = () => {
    return {
      server: this.state.electrumServer.trim(),
      pemCert: this.state.electrumCert,
      tls: this.isTLS(),
    };
  };

  add = () => {
    this.props.onAdd(this.getServer());
    this.setState({ electrumServer: '', electrumCert: '' });
  };

  downloadCert = () => {
    this.setState({
      loadingCert: true,
    });
    apiPost('certs/download', this.state.electrumServer.trim()).then(data => {
      if (data.success) {
        this.setState({ electrumCert: data.pemCert });
      } else {
        alertUser(data.errorMessage);
      }
      this.setState({ loadingCert: false });
    });
  };

  check = () => {
    this.setState({ loadingCheck: true });
    apiPost('electrum/check', this.getServer()).then(({ success, errorMessage }) => {
      if (success) {
        alertUser(this.props.t('settings.electrum.checkSuccess', { host: this.state.electrumServer }));
      } else {
        alertUser(this.props.t('settings.electrum.checkFailed') + ':\n' + errorMessage);
      }
      this.setState({
        valid: success,
        loadingCheck: false,
      });
    });
  };

  render() {
    const {
      t,
      onAdd,
      onRemove,
    } = this.props;
    const {
      valid,
      electrumServer,
      electrumCert,
      tls,
      loadingCheck,
      loadingCert,
    } = this.state;
    if (!onAdd) {
      return (
        <li>
          <div className={style.server}>
            <div className={style.serverLabel}>
              {electrumServer}
              {' '}
              <strong>{tls ? 'TLS' : 'TCP' }</strong>
            </div>
            <div>
              <button className={style.primary} disabled={electrumServer === '' || (tls && electrumCert === '') || loadingCheck} onClick={this.check}>
                {
                  loadingCheck && (
                    <div className={style.miniSpinnerContainer}>
                      <div className={style.miniSpinner}></div>
                    </div>
                  )
                }
                { loadingCheck ? t('settings.electrum.checking') : t('settings.electrum.check') }
              </button>
              <button className={style.warning} onClick={onRemove}>{t('settings.electrum.remove-server')}</button>
            </div>
          </div>
        </li>
      );
    }
    return (
      <div className={style.addServer}>
        <div className="flex flex-row flex-start flex-wrap">
          <p className={style.badge}>{t('settings.electrum.step1')}</p>
          <div className="flex-1">
            <p>{t('settings.electrum.step1-text')}</p>
          </div>
        </div>
        <Input
          name="electrumServer"
          onInput={this.handleFormChange}
          value={electrumServer}
          placeholder="host:port"
        />
        <div className="flex flex-row flex-start flex-wrap">
          <p className={style.badge}>{t('settings.electrum.step2')}</p>
          <div className="flex-1">
            <p>{t('settings.electrum.step2-text')}</p>
            <p>{t('settings.electrum.step2-text-tcp')}</p>
          </div>
        </div>
        <textarea
          className={style.textarea}
          rows={10}
          cols={80}
          name="electrumCert"
          onInput={this.handleFormChange}
          value={electrumCert}
          placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
        />
        <div className={[style.block, 'flex flex-row flex-end'].join(' ')}>
          <Button primary disabled={loadingCert || electrumCert !== ''} onClick={this.downloadCert}>
            {
              loadingCert && (
                <div className={style.miniSpinnerContainer}>
                  <div className={style.miniSpinner}></div>
                </div>
              )
            }
            {t('settings.electrum.download-cert')}
          </Button>
        </div>
        <div className="flex flex-row flex-start flex-wrap">
          <p className={style.badge}>{t('settings.electrum.step3')}</p>
          <div className="flex-1">
            <p>{t('settings.electrum.step3-text')}</p>
          </div>
        </div>
        <div className={['flex flex-row flex-end spaced', style.block].join(' ')}>
          <Button primary disabled={electrumServer === '' || loadingCheck} onClick={this.check}>
            {
              loadingCheck && (
                <div className={style.miniSpinnerContainer}>
                  <div className={style.miniSpinner}></div>
                </div>
              )
            }
            { loadingCheck ? t('settings.electrum.checking') : t('settings.electrum.check') }
          </Button>
          <Button primary disabled={!valid} onClick={this.add}>{t('settings.electrum.add-server')}</Button>
        </div>
        <div className="flex flex-row flex-start flex-wrap">
          <p className={style.badge}>{t('settings.electrum.step4')}</p>
          <div className="flex-1">
            <p>{t('settings.electrum.step4-text')}</p>
          </div>
        </div>
      </div>
    );
  }
}

export const ElectrumServer = withTranslation()(ElectrumServerClass);
