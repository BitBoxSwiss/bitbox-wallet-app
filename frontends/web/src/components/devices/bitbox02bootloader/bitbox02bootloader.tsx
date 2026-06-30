// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import * as bitbox02BootloaderAPI from '@/api/bitbox02bootloader';
import { useDarkmode } from '@/hooks/darkmode';
import { useSync, useLoad } from '@/hooks/api';
import { Button } from '@/components/forms';
import { View, ViewContent } from '@/components/view/view';
import { BitBox02, BitBox02Inverted, BitBox02Nova, BitBox02NovaInverted } from '@/components/icon/logo';
import { Message } from '@/components/message/message';
import { SubTitle } from '@/components/title';
import { ToggleShowFirmwareHash } from './toggleshowfirmwarehash';
import style from './bitbox02bootloader.module.css';

type TProps = {
  deviceID: string;
};

export const BitBox02Bootloader = ({ deviceID }: TProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const status = useSync(
    () => bitbox02BootloaderAPI.getStatus(deviceID),
    bitbox02BootloaderAPI.syncStatus(deviceID),
  );
  const info = useLoad(
    status === undefined || status.upgrading ? null : () => bitbox02BootloaderAPI.getInfo(deviceID),
    [deviceID, status?.upgrading],
  );
  if (status === undefined || (info === undefined && !status.upgrading)) {
    return null;
  }

  let contents;
  if (status.upgrading) {
    if (status.upgradeSuccessful) {
      contents = (
        <div className="box large">
          <p style={{ marginBottom: 0 }}>
            {t('bb02Bootloader.success', {
              context: (status.erased ? 'install' : ''),
            })}
          </p>
        </div>
      );
    } else {
      const value = Math.round(status.progress * 100);
      contents = (
        <>
          <SubTitle className={style.upgradingTitle}>
            {t('bb02Bootloader.upgradeTitle', { context: (status.erased ? 'install' : '') })}
          </SubTitle>
          { status.additionalUpgradeFollows ? (
            <p className={style.additionalUpgrade}>
              {t('bb02Bootloader.additionalUpgradeFollows1')}
            </p>
          ) : null }
          <progress className={style.progressBar} value={value} max="100">{value}%</progress>
          <div className={style.progressInfo}>
            <span>
              {t('bootloader.progress', {
                context: (status.erased ? 'install' : ''),
              })}
            </span>
            <span>
              {value}%
            </span>
          </div>

          { status.additionalUpgradeFollows ? (
            <p className={style.additionalUpgrade}>
              {t('bb02Bootloader.additionalUpgradeFollows2')}
            </p>
          ) : null }
        </>
      );
    }
  } else {
    if (info === undefined) {
      return null;
    }
    contents = (
      <div className="box large" style={{ minHeight: 340 }}>
        {info.erased && (
          <div>
            <h2>{t('welcome.title')}</h2>
            <h3 className="subTitle">{t('welcome.getStarted')}</h3>
          </div>
        )}
        <div className="buttons">
          { info.canUpgrade ? (
            <Button
              primary
              onClick={() => bitbox02BootloaderAPI.upgradeFirmware(deviceID)}>
              {t('bootloader.button', { context: (info.erased ? 'install' : '') })}
            </Button>
          ) : null }
          { !info.erased && (
            <Button
              secondary
              onClick={() => bitbox02BootloaderAPI.reboot(deviceID)}>
              {t('bb02Bootloader.abort', { context: !info.canUpgrade ? 'noUpgrade' : '' })}
            </Button>
          )}
        </div>
        <div className="flex flex-center" style={{ marginTop: 32 }}>
          {t('bb02Bootloader.orientation')}&nbsp;
          <Button
            inline
            onClick={() => bitbox02BootloaderAPI.screenRotate(deviceID)}
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

  const logo =
    (status.product === 'bitbox02-plus-multi' || status.product === 'bitbox02-plus-btconly') ?
      (isDarkMode ? <BitBox02NovaInverted /> : <BitBox02Nova />) :
      (isDarkMode ? <BitBox02Inverted /> : <BitBox02 />);

  return (
    <View fitContent verticallyCentered width="556px">
      <ViewContent>
        {logo}
        {status.errMsg && (
          <Message type="warning">
            {status.errMsg}
          </Message>
        )}
        {contents}
      </ViewContent>
    </View>
  );
};
