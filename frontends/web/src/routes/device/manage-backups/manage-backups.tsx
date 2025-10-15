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
import { TDevices } from '@/api/devices';
import { SubTitle } from '@/components/title';
import { BackButton } from '@/components/backbutton/backbutton';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { Header } from '@/components/layout';
import { Backups } from '@/routes/device/bitbox01/backups';
import { BackupsV2 } from '@/routes/device/bitbox02/backups';
import { SDCardCheck } from '@/routes/device/bitbox02/sdcardcheck';

type TProps = {
  deviceID: string | null;
  devices: TDevices
};

export const ManageBackups = ({
  deviceID,
  devices,
}: TProps) => {
  const { t } = useTranslation();

  if (!deviceID || !devices[deviceID]) {
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
  const { t } = useTranslation();
  if (!deviceID) {
    return null;
  }
  switch (devices[deviceID]) {
  case 'bitbox':

    return (
      <>
        <SubTitle>{t('backup.list')}</SubTitle>
        <Backups
          deviceID={deviceID}
          showCreate={true}
          showRestore={false}>
          <BackButton>
            {t('button.back')}
          </BackButton>
        </Backups>
      </>
    );
  case 'bitbox02':
    return (
      <SDCardCheck deviceID={deviceID}>
        <BackupsV2
          deviceID={deviceID}
          showCreate={true}
          showRestore={false}
          showRadio={false}>
          <BackButton>
            {t('button.back')}
          </BackButton>
        </BackupsV2>
      </SDCardCheck>
    );
  default:
    return null;
  }
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
        <Entry key="guide.backups.whatIsABackup" entry={t('guide.backups.whatIsABackup', { returnObjects: true })} />
        <Entry key="guide.backups.encrypt" entry={t('guide.backups.encrypt', { returnObjects: true })} />
        <Entry key="guide.backups.check" entry={t('guide.backups.check', { returnObjects: true })} />
        <Entry key="guide.backups.howOften" entry={t('guide.backups.howOften', { returnObjects: true })} />
      </Guide>
    );
  case 'bitbox02':
    return (
      <Guide>
        <Entry key="guide.backupsBB02.whatIsABackup" entry={t('guide.backupsBB02.whatIsABackup', { returnObjects: true })} />
        <Entry key="guide.backupsBB02.encrypt" entry={t('guide.backupsBB02.encrypt', { returnObjects: true })} shown={true} />
        <Entry key="guide.backupsBB02.check" entry={t('guide.backupsBB02.check', { returnObjects: true })} />
        <Entry key="guide.backups.howOften" entry={t('guide.backups.howOften', { returnObjects: true })} />
      </Guide>
    );
  default:
    return null;
  }
};
