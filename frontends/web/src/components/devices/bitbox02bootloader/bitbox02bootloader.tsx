/**
 * Copyright 2018 Shift Devices AG
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
import * as bitbox02BootloaderAPI from '../../../api/bitbox02bootloader';
import { useLoad, useSync } from '../../../hooks/api';
import { useDarkmode } from '../../../hooks/darkmode';
import { CenteredContent } from '../../centeredcontent/centeredcontent';
import { Button } from '../../forms';
import { BitBox02, BitBox02Inverted } from '../../icon/logo';
import { Status } from '../../status/status';
import { ToggleShowFirmwareHash } from './toggleshowfirmwarehash';

type TProps = {
  deviceID: string;
}

export const BitBox02Bootloader = ({ deviceID }: TProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const status = useSync(
    () => bitbox02BootloaderAPI.getStatus(deviceID),
    bitbox02BootloaderAPI.syncStatus(deviceID),
  );
  const versionInfo = useLoad(() => bitbox02BootloaderAPI.getVersionInfo(deviceID));

  if (versionInfo === undefined) {
    return null;
  }

  let contents;
  if (status && status.upgrading) {
    if (status.upgradeSuccessful) {
      contents = (
        <div className="box large">
          <p style={{ marginBottom: 0 }}>
            {t('bb02Bootloader.success', {
              context: (versionInfo.erased ? 'install' : ''),
            })}
          </p>
        </div>
      );
    } else {
      const value = Math.round(status.progress * 100);
      contents = (
        <div className="box large">
          <h2 className="subTitle">
            {t('bb02Bootloader.upgradeTitle', { context: (versionInfo.erased ? 'install' : '') })}
          </h2>
          { versionInfo.additionalUpgradeFollows ? (
            <>
              <p>{t('bb02Bootloader.additionalUpgradeFollows1')}</p>
              <p>{t('bb02Bootloader.additionalUpgradeFollows2')}</p>
            </>
          ) : null }
          <progress value={value} max="100">{value}%</progress>
          <p style={{ marginBottom: 0 }}>
            {t('bootloader.progress', {
              progress: value.toString(),
              context: (versionInfo.erased ? 'install' : ''),
            })}
          </p>
        </div>
      );
    }
  } else {
    contents = (
      <div className="box large" style={{ minHeight: 390 }}>
        {versionInfo.erased && (
          <div>
            <h2>{t('welcome.title')}</h2>
            <h3 className="subTitle">{t('welcome.getStarted')}</h3>
          </div>
        )}
        <div className="buttons">
          { versionInfo.canUpgrade ? (
            <Button
              primary
              onClick={() => bitbox02BootloaderAPI.upgradeFirmware(deviceID)}>
              {t('bootloader.button', { context: (versionInfo.erased ? 'install' : '') })}
            </Button>
          ) : null }
          { !versionInfo.erased && (
            <Button
              secondary
              onClick={() => bitbox02BootloaderAPI.reboot(deviceID)}>
              {t('bb02Bootloader.abort', { context: !versionInfo.canUpgrade ? 'noUpgrade' : '' })}
            </Button>
          )}
        </div>
        <div className="flex flex-center" style={{ marginTop: 32 }}>
          {t('bb02Bootloader.orientation')}&nbsp;
          <Button
            onClick={() => bitbox02BootloaderAPI.screenRotate(deviceID)}
            style={{ height: 'auto', padding: 0, textDecoration: 'underline' }}
            transparent>
            {t('bb02Bootloader.flipscreen')}
          </Button>
        </div>
        <hr/>
        <details>
          <summary>
            {t('bb02Bootloader.advanced.label')}
          </summary>
          <div>
            <br />
            <ToggleShowFirmwareHash deviceID={deviceID} />
          </div>
        </details>
      </div>
    );
  }
  return (
    <CenteredContent>
      {isDarkMode ? <BitBox02Inverted /> : <BitBox02 />}
      {status && status.errMsg && (
        <Status type="warning">{status.errMsg}</Status>
      )}
      {contents}
    </CenteredContent>
  );
};
