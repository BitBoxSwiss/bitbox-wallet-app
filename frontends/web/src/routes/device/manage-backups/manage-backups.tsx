// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { TDevices } from '@/api/devices';
import { SubTitle } from '@/components/title';
import { BackButton } from '@/components/backbutton/backbutton';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { Header } from '@/components/layout';
import { Backups } from '@/routes/device/bitbox01/backups';
import { BackupsV2 } from '@/routes/device/bitbox02/backups';
import { Create as CreateBackupV2 } from '@/routes/device/bitbox02/createbackup';
import { Check as CheckBackupV2 } from '@/routes/device/bitbox02/checkbackup';
import { SDCardCheck } from '@/routes/device/bitbox02/sdcardcheck';
import { HorizontallyCenteredSpinner } from '@/components/spinner/SpinnerAnimation';

type TProps = {
  deviceID: string | null;
  devices: TDevices;
};

type TBackupMode = 'create' | 'check' | 'list';

const isBackupMode = (mode: string | null): mode is TBackupMode => {
  return mode === 'create' || mode === 'check' || mode === 'list';
};

const getBackupMode = (search: string): TBackupMode | undefined => {
  const mode = new URLSearchParams(search).get('mode');
  return isBackupMode(mode) ? mode : undefined;
};

const getTitle = (mode: TBackupMode | undefined, t: (input: string) => string) => {
  switch (mode) {
  case 'create':
    return t('backup.create.title');
  case 'check':
    return t('backup.check.title');
  case 'list':
    return t('backup.list');
  default:
    return t('backup.title');
  }
};

export const ManageBackups = ({
  deviceID,
  devices,
}: TProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const mode = getBackupMode(location.search);
  const autoStartID = mode ? `${location.key}-${mode}` : undefined;

  if (!deviceID || !devices[deviceID]) {
    return null;
  }

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header
            title={<h2>{getTitle(mode, t)}</h2>}
          />
          <div className="content padded">
            <BackupsList
              deviceID={deviceID}
              devices={devices}
              mode={mode}
              autoStartID={autoStartID}
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
  mode,
  autoStartID,
}: TProps & { mode?: TBackupMode; autoStartID?: string }) => {
  const { t } = useTranslation();
  if (!deviceID) {
    return null;
  }

  const showCreate = mode === undefined || mode === 'create';
  const showCheck = mode === undefined || mode === 'check';

  switch (devices[deviceID]) {
  case 'bitbox':

    return (
      <>
        <SubTitle>{t('backup.list')}</SubTitle>
        <Backups
          deviceID={deviceID}
          showCreate={showCreate}
          showCheck={showCheck}
          showRestore={false}>
          <BackButton>
            {t('button.back')}
          </BackButton>
        </Backups>
      </>
    );
  case 'bitbox02':
    if (mode === 'create') {
      return (
        <SDCardCheck deviceID={deviceID}>
          <AutoStartCreateBackup
            deviceID={deviceID}
            autoStartID={autoStartID}
          />
        </SDCardCheck>
      );
    }
    if (mode === 'check') {
      return (
        <SDCardCheck deviceID={deviceID}>
          <AutoStartCheckBackup
            deviceID={deviceID}
            autoStartID={autoStartID}
          />
        </SDCardCheck>
      );
    }
    return (
      <SDCardCheck deviceID={deviceID}>
        <BackupsV2
          deviceID={deviceID}
          showCreate={showCreate}
          showCheck={showCheck}
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

const AutoStartCreateBackup = ({ deviceID, autoStartID }: { deviceID: string; autoStartID?: string }) => {
  const { t } = useTranslation();
  return (
    <div className="box m-top-default">
      <HorizontallyCenteredSpinner />
      <CreateBackupV2
        deviceID={deviceID}
        autoStart
        autoStartID={autoStartID}
        showButton={false}
      />
      <div className="buttons">
        <BackButton>
          {t('button.back')}
        </BackButton>
      </div>
    </div>
  );
};

const AutoStartCheckBackup = ({ deviceID, autoStartID }: { deviceID: string; autoStartID?: string }) => {
  const { t } = useTranslation();
  return (
    <div className="box m-top-default">
      <HorizontallyCenteredSpinner />
      <CheckBackupV2
        deviceID={deviceID}
        backups={[]}
        disabled={false}
        autoStart
        autoStartID={autoStartID}
        showButton={false}
      />
      <div className="buttons">
        <BackButton>
          {t('button.back')}
        </BackButton>
      </div>
    </div>
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
