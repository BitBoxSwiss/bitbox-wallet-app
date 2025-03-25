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

import { useState, useEffect } from 'react';
import { useLoad } from '@/hooks/api';
import { useTranslation } from 'react-i18next';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { ViewContent, View } from '@/components/view/view';
import { WithSettingsTabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './types';
import { ManageBackupSetting } from './components/device-settings/manage-backup-setting';
import { ShowRecoveryWordsSetting } from './components/device-settings/show-recovery-words-setting';
import { GoToStartupSettings } from './components/device-settings/go-to-startup-settings';
import { PassphraseSetting } from './components/device-settings/passphrase-setting';
import {
  DeviceInfo,
  getDeviceInfo,
  getVersion,
  getRootFingerprint,
} from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { Skeleton } from '@/components/skeleton/skeleton';
import { AttestationCheckSetting } from './components/device-settings/attestation-check-setting';
import { FirmwareSetting } from './components/device-settings/firmware-setting';
import { SecureChipSetting } from './components/device-settings/secure-chip-setting';
import { DeviceNameSetting } from './components/device-settings/device-name-setting';
import { FactoryResetSetting } from './components/device-settings/factory-reset-setting';
import { RootFingerprintSetting } from './components/device-settings/root-fingerprint-setting';
import { Bip85Setting } from './components/device-settings/bip85-setting';
import { ManageDeviceGuide } from '@/routes/device/bitbox02/settings-guide';
import { MobileHeader } from './components/mobile-header';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import styles from './bb02-settings.module.css';

type TProps = {
  deviceID: string;
};

type TWrapperProps = TProps & TPagePropsWithSettingsTabs;

export const StyledSkeleton = () => {
  return (
    <div className={styles.skeletonWrapper}>
      <Skeleton fontSize="var(--item-height-xlarge)" />
    </div>
  );
};

const BB02Settings = ({ deviceID, devices, hasAccounts }: TWrapperProps) => {
  const { t } = useTranslation();
  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <ContentWrapper>
            <GlobalBanners />
          </ContentWrapper>
          <Header
            hideSidebarToggler
            title={
              <>
                <h2 className="hide-on-small">{t('sidebar.settings')}</h2>
                <MobileHeader withGuide title={t('sidebar.device')} />
              </>
            }
          />
          <View fullscreen={false}>
            <ViewContent>
              <WithSettingsTabs
                devices={devices}
                hideMobileMenu
                hasAccounts={hasAccounts}
              >
                <Content deviceID={deviceID} />
              </WithSettingsTabs>
            </ViewContent>
          </View>
        </GuidedContent>
        <ManageDeviceGuide />
      </GuideWrapper>
    </Main>
  );
};

const Content = ({ deviceID }: TProps) => {
  const { t } = useTranslation();

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>();
  const versionInfo = useLoad(() => getVersion(deviceID), [deviceID]);
  const rootFingerprintResult = useLoad(
    () => getRootFingerprint(deviceID),
    [deviceID],
  );

  useEffect(() => {
    getDeviceInfo(deviceID)
      .then((result) => {
        if (!result.success) {
          alertUser(t('genericError'));
          return;
        }
        setDeviceInfo(result.deviceInfo);
      })
      .catch(console.error);
  }, [deviceID, t]);

  return (
    <>
      {/*"Backups" section*/}
      <div className={styles.section}>
        <h3 className="subTitle">{t('deviceSettings.backups.title')}</h3>
        <ManageBackupSetting deviceID={deviceID} />
        <ShowRecoveryWordsSetting deviceID={deviceID} />
      </div>

      {/*"Device information" section*/}
      <div className={styles.section}>
        <h3 className="subTitle">
          {t('deviceSettings.deviceInformation.title')}
        </h3>
        {deviceInfo ? (
          <DeviceNameSetting deviceName={deviceInfo.name} deviceID={deviceID} />
        ) : (
          <StyledSkeleton />
        )}
        <AttestationCheckSetting deviceID={deviceID} />
        {versionInfo ? (
          <FirmwareSetting deviceID={deviceID} versionInfo={versionInfo} />
        ) : (
          <StyledSkeleton />
        )}
        {deviceInfo && deviceInfo.securechipModel !== '' ? (
          <SecureChipSetting secureChipModel={deviceInfo.securechipModel} />
        ) : (
          <StyledSkeleton />
        )}
        {rootFingerprintResult && rootFingerprintResult.success ? (
          <RootFingerprintSetting
            rootFingerprint={rootFingerprintResult.rootFingerprint}
          />
        ) : (
          <StyledSkeleton />
        )}
      </div>

      {/*"Expert settings" section*/}
      <div className={styles.section}>
        <h3 className="subTitle">{t('settings.expert.title')}</h3>
        {deviceInfo ? (
          <PassphraseSetting
            passphraseEnabled={deviceInfo.mnemonicPassphraseEnabled}
            deviceID={deviceID}
          />
        ) : (
          <StyledSkeleton />
        )}
        {versionInfo ? (
          <Bip85Setting canBIP85={versionInfo.canBIP85} deviceID={deviceID} />
        ) : (
          <StyledSkeleton />
        )}
        <GoToStartupSettings deviceID={deviceID} />
        <FactoryResetSetting deviceID={deviceID} />
      </div>
    </>
  );
};

export { BB02Settings };
