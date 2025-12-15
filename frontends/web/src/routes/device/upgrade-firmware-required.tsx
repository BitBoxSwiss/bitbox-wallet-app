// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { VersionInfo } from '@/api/bitbox02';
import { View, ViewButtons, ViewHeader } from '@/components/view/view';
import { Header, Main } from '@/components/layout';
import { FirmwareSetting } from '@/routes/settings/components/device-settings/firmware-setting';

type TProps = {
  deviceID: string;
  versionInfo: VersionInfo;
};

export const FirmwareUpgradeRequired = ({
  deviceID,
  versionInfo,
}: TProps) => {
  const { t } = useTranslation();
  return (
    <Main>
      <Header />
      <View
        fullscreen
        verticallyCentered
        textCenter
        width="840px"
        withBottomBar>
        <ViewHeader title={t('upgradeFirmware.label')} />
        <ViewButtons>
          <div>
            <FirmwareSetting
              asButton
              deviceID={deviceID}
              versionInfo={versionInfo} />
          </div>
        </ViewButtons>
      </View>
    </Main>
  );
};
