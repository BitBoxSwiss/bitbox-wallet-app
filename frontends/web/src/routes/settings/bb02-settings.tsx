// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react';
import { useLoad } from '@/hooks/api';
import { useTranslation } from 'react-i18next';
import { runningInIOS } from '@/utils/env';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { ViewContent, View } from '@/components/view/view';
import { WithSettingsTabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './types';
import { ManageBackupSetting } from './components/device-settings/manage-backup-setting';
import { ShowRecoveryWordsSetting } from './components/device-settings/show-recovery-words-setting';
import { GoToStartupSettings } from './components/device-settings/go-to-startup-settings';
import { PassphraseSetting } from './components/device-settings/passphrase-setting';
import { DeviceInfo, getDeviceInfo, getVersion, getRootFingerprint } from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { Skeleton } from '@/components/skeleton/skeleton';
import { AttestationCheckSetting } from './components/device-settings/attestation-check-setting';
import { FirmwareSetting } from './components/device-settings/firmware-setting';
import { BluetoothFirmwareSetting } from './components/device-settings/bluetooth-firmware-setting';
import { BluetoothToggleEnabledSetting } from './components/device-settings/bluetooth-toggle-enabled-setting';
import { ChangeDevicePasswordSetting } from './components/device-settings/change-password-setting';
import { SecureChipSetting } from './components/device-settings/secure-chip-setting';
import { DeviceNameSetting } from './components/device-settings/device-name-setting';
import { FactoryResetSetting } from './components/device-settings/factory-reset-setting';
import { RootFingerprintSetting } from './components/device-settings/root-fingerprint-setting';
import { Bip85Setting } from './components/device-settings/bip85-setting';
import { ManageDeviceGuide } from '@/routes/device/bitbox02/settings-guide';
import { MobileHeader } from './components/mobile-header';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { SubTitle } from '@/components/title';
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
            <GlobalBanners devices={devices} />
          </ContentWrapper>
          <Header
            hideSidebarToggler
            title={
              <>
                <h2 className="hide-on-small">{t('sidebar.settings')}</h2>
                <MobileHeader withGuide title={t('sidebar.device')} />
              </>
            }/>
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
  const rootFingerprintResult = useLoad(() => getRootFingerprint(deviceID), [deviceID]);

  useEffect(() => {
    getDeviceInfo(deviceID)
      .then(result => {
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
        <SubTitle className={styles.withMobilePadding}>{t('deviceSettings.backups.title')}</SubTitle>
        <ManageBackupSetting deviceID={deviceID} />
        <ShowRecoveryWordsSetting deviceID={deviceID} />
      </div>

      {/*"Device settings" section*/}
      <div className={styles.section}>
        <SubTitle className={styles.withMobilePadding}>{t('deviceSettings.deviceSettings.title')}</SubTitle>
        {deviceInfo ? (
          <DeviceNameSetting
            deviceName={deviceInfo.name}
            deviceID={deviceID}
          />
        ) :
          <StyledSkeleton />
        }
        { deviceInfo && deviceInfo.bluetooth && !runningInIOS()
          ? <BluetoothToggleEnabledSetting deviceID={deviceID} />
          : null
        }
        {
          versionInfo ? (
            <ChangeDevicePasswordSetting
              deviceID={deviceID}
              canChangePassword={versionInfo.canChangePassword}
            />
          ) : (
            <StyledSkeleton />
          )
        }
      </div>

      {/*"Device information" section*/}
      <div className={styles.section}>
        <SubTitle className={styles.withMobilePadding}>{t('deviceSettings.deviceInformation.title')}</SubTitle>
        {
          versionInfo ? (
            <FirmwareSetting
              deviceID={deviceID}
              versionInfo={versionInfo}
            />
          ) :
            <StyledSkeleton />
        }
        {
          deviceInfo && deviceInfo.bluetooth ? (
            <BluetoothFirmwareSetting
              firmwareVersion={deviceInfo.bluetooth.firmwareVersion}
            />
          ) : null
        }
        <AttestationCheckSetting deviceID={deviceID} />
        {
          rootFingerprintResult && rootFingerprintResult.success ?
            <RootFingerprintSetting rootFingerprint={rootFingerprintResult.rootFingerprint} />
            :
            <StyledSkeleton />
        }
        {
          deviceInfo && deviceInfo.securechipModel !== '' ?
            <SecureChipSetting secureChipModel={deviceInfo.securechipModel} />
            :
            <StyledSkeleton />
        }
      </div>

      {/*"Expert settings" section*/}
      <div className={styles.section}>
        <SubTitle className={styles.withMobilePadding}>{t('settings.expert.title')}</SubTitle>
        {
          deviceInfo ? (
            <PassphraseSetting
              passphraseEnabled={deviceInfo.mnemonicPassphraseEnabled}
              deviceID={deviceID}
            />
          ) : (
            <StyledSkeleton />
          )
        }
        {
          versionInfo ? (
            <Bip85Setting
              canBIP85={versionInfo.canBIP85}
              deviceID={deviceID}
            />
          ) : (
            <StyledSkeleton />
          )
        }
        <GoToStartupSettings deviceID={deviceID} />
        <FactoryResetSetting deviceID={deviceID} />
      </div>
    </>
  );
};

export { BB02Settings };
