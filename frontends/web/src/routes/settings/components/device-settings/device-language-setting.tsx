// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errUserAbort, setDeviceLanguage } from '@/api/bitbox02';
import { alertUser } from '@/components/alert/Alert';
import { Dropdown } from '@/components/dropdown/dropdown';
import { PointToBitBox02 } from '@/components/icon';
import { defaultLanguages } from '@/components/language/types';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { useMediaQuery } from '@/hooks/mediaquery';
import { useMountedRef } from '@/hooks/mount';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import settingsDropdownStyles from '../appearance/settingsdropdown.module.css';

type TProps = {
  deviceID: string;
  language: string;
  supportedLanguages: string[];
};

export const DeviceLanguageSetting = ({ deviceID, language, supportedLanguages }: TProps) => {
  const { t } = useTranslation();
  const mounted = useMountedRef();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isMobileSelectorOpen, setIsMobileSelectorOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [inProgress, setInProgress] = useState(false);
  const languages = supportedLanguages.map(code => ({
    label: defaultLanguages.find(language => language.code === code)?.display || code,
    value: code,
  }));

  const changeLanguage = async (language: string) => {
    if (inProgress || language === selectedLanguage) {
      return;
    }
    setInProgress(true);
    try {
      const result = await setDeviceLanguage(deviceID, language);
      if (!mounted.current) {
        return;
      }
      if (!result.success) {
        if (result.code === errUserAbort) {
          alertUser(t('deviceSettings.deviceLanguage.error_104'));
        } else {
          alertUser(result.message || t('genericError'));
        }
        return;
      }
      setSelectedLanguage(language);
      alertUser(t('deviceSettings.deviceLanguage.success'));
    } catch (error) {
      console.error(error);
      if (mounted.current) {
        alertUser(t('genericError'));
      }
    } finally {
      if (mounted.current) {
        setInProgress(false);
      }
    }
  };

  return (
    <>
      <SettingsItem
        onClick={isMobile && !isMobileSelectorOpen ? () => setIsMobileSelectorOpen(true) : undefined}
        disabled={inProgress}
        settingName={t('deviceSettings.deviceLanguage.title')}
        secondaryText={t('deviceSettings.deviceLanguage.description')}
        collapseOnSmall
        extraComponent={
          <Dropdown
            isOpen={isMobileSelectorOpen}
            onOpenChange={setIsMobileSelectorOpen}
            mobileFullScreen
            isDisabled={inProgress}
            className={settingsDropdownStyles.select}
            renderOptions={option => option.label}
            options={languages}
            title={t('deviceSettings.deviceLanguage.title')}
            aria-label={t('deviceSettings.deviceLanguage.title')}
            onChange={selected => changeLanguage(selected.value)}
            value={languages.find(language => language.value === selectedLanguage)}
          />
        }
      />
      {inProgress && (
        <WaitDialog title={t('deviceSettings.deviceLanguage.title')}>
          <p>{t('bitbox02Interact.followInstructions')}</p>
          <PointToBitBox02 />
        </WaitDialog>
      )}
    </>
  );
};
