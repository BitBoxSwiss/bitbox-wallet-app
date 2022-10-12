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
import { withTranslation } from 'react-i18next';
import { ElectrumServer } from './electrum-server';
import { apiGet, apiPost } from '../../utils/request';
import { confirmation } from '../../components/confirm/Confirm';
import style from './electrum.module.css';
import A from '../../components/anchor/anchor';


class ElectrumServersClass extends Component {
  state = {
    electrumServers: [],
  };

  componentDidMount() {
    apiGet('config').then(config => {
      this.setState({ electrumServers: config.backend[this.props.coin].electrumServers });
    });
  }

  save = () => {
    apiGet('config').then(config => {
      config.backend[this.props.coin].electrumServers = this.state.electrumServers;
      apiPost('config', config);
    });
  };

  onAdd = server => {
    let electrumServers = this.state.electrumServers.slice();
    electrumServers.push(server);
    this.setState({ electrumServers });
    this.save();
  };

  onRemove = index => {
    let electrumServers = this.state.electrumServers.slice();
    electrumServers.splice(index, 1);
    this.setState({ electrumServers });
    this.save();
  };

  resetToDefault = () => {
    confirmation(this.props.t('settings.electrum.resetConfirm'), response => {
      if (response) {
        apiGet('config/default').then(config => {
          this.setState({ electrumServers: config.backend[this.props.coin].electrumServers });
          this.save();
        });
      } else {
        return;
      }
    });
  };

  render() {
    const { t } = this.props;
    const { electrumServers } = this.state;
    let onRemove = (server, index) => (() => {
      confirmation(t('settings.electrum.removeConfirm', { server: server.server }), confirmed => {
        if (confirmed) {
          this.onRemove(index);
        }
      });
    });
    return (
      <div className={style.serversContainer}>
        <div className="row">
          <div className={['flex flex-row flex-between flex-items-center', style.titleContainer].join(' ')}>
            <h4 className="subTitle m-none">{t('settings.electrum.servers')}</h4>
            <A href="#" className={['labelLarge labelLink', style.resetLink].join(' ')} onClick={this.resetToDefault}>{t('settings.electrum.reset')}</A>
          </div>
          <ul className={style.servers}>
            {
              electrumServers.map((server, index) => (
                <ElectrumServer
                  // @ts-ignore
                  key={server.server + server.tls.toString()}
                  server={server}
                  onRemove={onRemove(server, index)}
                />
              ))
            }
          </ul>
        </div>
        <hr />
        <div className="row">
          <h4 className="subTitle">{t('settings.electrum.add')}</h4>
          <ElectrumServer server={null} onAdd={this.onAdd} />
        </div>
      </div>
    );
  }
}

export const ElectrumServers = withTranslation()(ElectrumServersClass);
