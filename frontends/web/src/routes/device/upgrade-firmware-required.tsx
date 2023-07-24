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
import { VersionInfo } from '../../api/bitbox02';
import { View, ViewButtons, ViewHeader } from '../../components/view/view';
import { Header, Main } from '../../components/layout';
import { FirmwareSetting } from '../settings/components/device-settings/firmware-setting';

type TProps = {
  deviceID: string;
  versionInfo: VersionInfo;
}

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
