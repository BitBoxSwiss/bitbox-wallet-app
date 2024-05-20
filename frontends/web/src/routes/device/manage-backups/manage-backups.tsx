/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2024 Shift Crypto AG
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

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TDevices } from '../../../api/devices';
import { ButtonLink } from '../../../components/forms';
import { Guide } from '../../../components/guide/guide';
import { Entry } from '../../../components/guide/entry';
import { Header } from '../../../components/layout';
import { Backups } from '../bitbox01/backups';
import { BackupsV2 } from '../bitbox02/backups';
import { SDCardCheck } from '../bitbox02/sdcardcheck';

type TProps = {
  deviceID: string | null;
  devices: TDevices
}

export const ManageBackups = ({
  deviceID,
  devices,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!deviceID || !devices[deviceID]) {
    navigate('/');
    return null;
  }

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header
            title={<h2>{t('backup.title')}</h2>}
          />
          <div className="content padded">
            <h3 className="subTitle">{t('backup.list')}</h3>
            <BackupsList
              deviceID={deviceID}
              devices={devices}
            />
          </div>
        </div>
      </div>
      <ManageBackupGuide
        deviceID={deviceID}
        devices={devices}
      />
    </div>
  );
};

const BackupsList = ({
  deviceID,
  devices,
}: TProps) => {
  if (!deviceID) {
    return null;
  }
  switch (devices[deviceID]) {
  case 'bitbox':
    return (
      <Backups
        deviceID={deviceID}
        showCreate={true}
        showRestore={false}>
        <BackButton deviceID={deviceID} />
      </Backups>
    );
  case 'bitbox02':
    return (
      <SDCardCheck deviceID={deviceID}>
        <BackupsV2
          deviceID={deviceID}
          showCreate={true}
          showRestore={false}
          showRadio={false}>
          <BackButton deviceID={deviceID} />
        </BackupsV2>
      </SDCardCheck>
    );
  default:
    return null;
  }
};

const BackButton = ({ deviceID }: { deviceID: string }) => {
  const { t } = useTranslation();
  return (
    <ButtonLink
      secondary
      to={`/settings/device-settings/${deviceID}`}>
      {t('button.back')}
    </ButtonLink>
  );
};

const ManageBackupGuide = ({
  deviceID,
  devices,
}: TProps) => {
  const { t } = useTranslation();

  if (!deviceID) {
    return null;
  }

  switch (devices[deviceID]) {
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
};
