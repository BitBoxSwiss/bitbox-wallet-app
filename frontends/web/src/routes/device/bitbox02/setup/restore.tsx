/**
 * Copyright 2023 Shift Crypto AG
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
import { BackupsV2 } from '../backups';
import { Backup } from '../../components/backup';
import { View, ViewContent, ViewHeader } from '../../../../components/view/view';
import { Button } from '../../../../components/forms';

type Props = {
  deviceID: string;
  settingPassword: boolean;
  onSelectBackup: (backup: Backup) => void;
  onRestoreBackup: (success: boolean) => void;
  onBack: () => void;
}

export const RestoreFromSDCardBackup = ({
  deviceID,
  settingPassword,
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
      <ViewHeader title={t('backup.restore.confirmTitle')} />
      <ViewContent>
        <BackupsV2
          deviceID={deviceID}
          showRestore={true}
          showRadio={true}
          onSelectBackup={onSelectBackup}
          onRestoreBackup={onRestoreBackup}>
          <Button
            transparent
            onClick={onBack}
            disabled={settingPassword}>
            {t('button.back')}
          </Button>
        </BackupsV2>
      </ViewContent>
    </View>
  );
};
