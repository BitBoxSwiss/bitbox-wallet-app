// SPDX-License-Identifier: Apache-2.0

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
  devices: TDevices;
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
        <Entry key="guide.backups.whatIsABackup" entry={{
          text: t('guide.backups.whatIsABackup.text'),
          title: t('guide.backups.whatIsABackup.title'),
        }} />
        <Entry key="guide.backups.encrypt" entry={{
          text: t('guide.backups.encrypt.text'),
          title: t('guide.backups.encrypt.title'),
        }} />
        <Entry key="guide.backups.check" entry={{
          text: t('guide.backups.check.text'),
          title: t('guide.backups.check.title'),
        }} />
        <Entry key="guide.backups.howOften" entry={{
          text: t('guide.backups.howOften.text'),
          title: t('guide.backups.howOften.title'),
        }} />
      </Guide>
    );
  case 'bitbox02':
    return (
      <Guide>
        <Entry key="guide.backupsBB02.whatIsABackup" entry={{
          text: t('guide.backupsBB02.whatIsABackup.text'),
          title: t('guide.backupsBB02.whatIsABackup.title'),
        }} />
        <Entry key="guide.backupsBB02.encrypt" entry={{
          text: t('guide.backupsBB02.encrypt.text'),
          title: t('guide.backupsBB02.encrypt.title'),
        }} shown={true} />
        <Entry key="guide.backupsBB02.check" entry={{
          text: t('guide.backupsBB02.check.text'),
          title: t('guide.backupsBB02.check.title'),
        }} />
        <Entry key="guide.backups.howOften" entry={{
          text: t('guide.backups.howOften.text'),
          title: t('guide.backups.howOften.title'),
        }} />
      </Guide>
    );
  default:
    return null;
  }
};
