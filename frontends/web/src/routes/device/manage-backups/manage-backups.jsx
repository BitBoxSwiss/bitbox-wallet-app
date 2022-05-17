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
import { route } from '../../../utils/route';
import { withTranslation } from 'react-i18next';
import { ButtonLink } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import { Entry } from '../../../components/guide/entry';
import { Header } from '../../../components/layout';
import { Backups } from '../bitbox01/backups';
import { BackupsV2 } from '../bitbox02/backups';
import { SDCardCheck } from '../bitbox02/sdcardcheck';

class ManageBackups extends Component {
  hasDevice = () => {
    return !!this.props.devices[this.props.deviceID];
  }

  UNSAFE_componentWillMount() {
    if (!this.hasDevice()) {
      route('/', true);
    }
  }

  backButton = () => {
    return (
      <ButtonLink
        transparent
        to={`/device/${this.props.deviceID}`}>
        {this.props.t('button.back')}
      </ButtonLink>
    );
  }

  listBackups  = () => {
    switch (this.props.devices[this.props.deviceID]) {
    case 'bitbox':
      return (
        <Backups
          deviceID={this.props.deviceID}
          showCreate={true}
          showRestore={false}>
          {this.backButton()}
        </Backups>
      );
    case 'bitbox02':
      return (
        <SDCardCheck deviceID={this.props.deviceID}>
          <BackupsV2
            deviceID={this.props.deviceID}
            showCreate={true}
            showRestore={false}
            showRadio={false}>
            {this.backButton()}
          </BackupsV2>
        </SDCardCheck>
      );
    default:
      return;
    }
  }

  renderGuide = t => {
    switch (this.props.devices[this.props.deviceID]) {
    case 'bitbox':
      return (
        <Guide>
          <Entry key="guide.backups.whatIsABackup" entry={t('guide.backups.whatIsABackup')} />
          <Entry key="guide.backups.encrypt" entry={t('guide.backups.encrypt')} />
          <Entry key="guide.backups.check" entry={t('guide.backups.check')} />
          <Entry key="guide.backups.howOften" entry={t('guide.backups.howOften')} />
        </Guide>
      );
    case 'bitbox02':
      return (
        <Guide>
          <Entry key="guide.backupsBB02.whatIsABackup" entry={t('guide.backupsBB02.whatIsABackup')} />
          <Entry key="guide.backupsBB02.encrypt" entry={t('guide.backupsBB02.encrypt')} shown={true} />
          <Entry key="guide.backupsBB02.check" entry={t('guide.backupsBB02.check')} />
          <Entry key="guide.backups.howOften" entry={t('guide.backups.howOften')} />
        </Guide>
      );
    default:
      return null;
    }
  }

  render() {
    const { t } = this.props;
    if (!this.hasDevice()) {
      return null;
    }
    return (
      <div className="contentWithGuide">
        <div className="container">
          <Header title={<h2>{t('backup.title')}</h2>} />
          <div className="innerContainer scrollableContainer">
            <div className="content padded">
              <h3 className="subTitle">{t('backup.list')}</h3>
              {this.listBackups()}
            </div>
          </div>
        </div>
        {this.renderGuide(t)}
      </div>
    );
  }
}

export default withTranslation()(ManageBackups);
