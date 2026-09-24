// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TBreezSDKLogLevel } from '@/api/config';
import { Dropdown, TOption } from '@/components/dropdown/dropdown';
import { Message } from '@/components/message/message';
import { useConfig } from '@/contexts/ConfigProvider';
import { useMediaQuery } from '@/hooks/mediaquery';
import { SettingsItem } from './settingsItem/settingsItem';
import settingsDropdownStyles from './appearance/settingsdropdown.module.css';

const logLevels: TBreezSDKLogLevel[] = ['error', 'warn', 'debug', 'trace'];

export const LightningLogLevelSetting = () => {
  const { t } = useTranslation();
  const { config, initialBreezSDKLogLevel, setConfig } = useConfig();
  const [isMobileSelectorOpen, setIsMobileSelectorOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  if (config === undefined) {
    return null;
  }

  const showRestartMessage = (
    initialBreezSDKLogLevel !== undefined
    && initialBreezSDKLogLevel !== config.backend.breezSDKLogLevel
  );

  const options: TOption<TBreezSDKLogLevel>[] = logLevels.map(value => ({
    value,
    label: t(`lightning.settings.logLevel.options.${value}`),
  }));

  return (
    <>
      {showRestartMessage ? (
        <Message type="warning">
          {t('settings.restart')}
        </Message>
      ) : null}
      <SettingsItem
        settingName={t('lightning.settings.logLevel.title')}
        collapseOnSmall
        onClick={isMobile && !isMobileSelectorOpen ? () => setIsMobileSelectorOpen(true) : undefined}
        extraComponent={
          <Dropdown
            className={settingsDropdownStyles.select}
            aria-label={t('lightning.settings.logLevel.title')}
            renderOptions={option => option.label}
            isMulti={false}
            isSearchable={false}
            options={options}
            value={options.find(option => option.value === config.backend.breezSDKLogLevel)}
            onChange={async selected => {
              if (selected.value === config.backend.breezSDKLogLevel) {
                return;
              }
              await setConfig({ backend: { breezSDKLogLevel: selected.value } });
            }}
            title={t('lightning.settings.logLevel.title')}
            mobileFullScreen
            isOpen={isMobileSelectorOpen}
            onOpenChange={setIsMobileSelectorOpen}
          />
        }
      />
    </>
  );
};
