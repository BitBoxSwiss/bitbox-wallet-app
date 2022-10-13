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
import { apiPost } from '../../utils/request';
import { alertUser } from '../../components/alert/Alert';
import style from './electrum.module.css';

class ElectrumServerClass extends Component {
  state = {
    loadingCheck: false,
  };

  check = () => {
    const server = this.props.server;
    this.setState({ loadingCheck: true });
    apiPost('electrum/check', {
      server: server.server.trim(),
      pemCert: server.pemCert,
      tls: server.tls,
    }).then(({ success, errorMessage }) => {
      if (success) {
        alertUser(this.props.t('settings.electrum.checkSuccess', { host: server.server }));
      } else {
        alertUser(this.props.t('settings.electrum.checkFailed') + ':\n' + errorMessage);
      }
      this.setState({
        loadingCheck: false,
      });
    });
  };

  render() {
    const {
      t,
      onRemove,
      server,
    } = this.props;
    const {
      loadingCheck,
    } = this.state;
    return (
      <li>
        <div className={style.server}>
          <div className={style.serverLabel}>
            {server.server}
            {' '}
            <strong>{server.tls ? 'TLS' : 'TCP' }</strong>
          </div>
          <div>
            <button className={style.primary} disabled={server.server === '' || (server.tls && server.pemCert === '') || loadingCheck} onClick={this.check}>
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
}

export const ElectrumServer = withTranslation()(ElectrumServerClass);
