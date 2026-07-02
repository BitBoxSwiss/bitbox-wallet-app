// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { BackupsV2 } from '@/routes/device/bitbox02/backups';
import { Backup } from '@/api/backup';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { MobileHeader } from '@/routes/settings/components/mobile-header';

type Props = {
  deviceID: string;
  onSelectBackup: (backup: Backup) => void;
  onRestoreBackup: (success: boolean) => void;
  onBack: () => void;
};

export const RestoreFromSDCardBackup = ({
  deviceID,
  onSelectBackup,
  onRestoreBackup,
  onBack,
}: Props) => {
  const { t } = useTranslation();
  return (
    <View
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar
      width="700px">
      <MobileHeader
        onClick={onBack}
        withViewPadding
        title={t('bitbox02Wizard.stepUninitialized.title')}
      />
      <ViewHeader
        small
        title={t('backup.restore.confirmTitle')}
      />
      <ViewContent>
        <BackupsV2
          deviceID={deviceID}
          showRestore={true}
          showRadio={true}
          onSelectBackup={onSelectBackup}
          onRestoreBackup={onRestoreBackup}
        >
          <DesktopBackButton
            onClick={onBack}>
            {t('button.back')}
          </DesktopBackButton>
        </BackupsV2>
      </ViewContent>
    </View>
  );
};
