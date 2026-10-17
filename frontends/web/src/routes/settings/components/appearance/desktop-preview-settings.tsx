// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDesktopChrome } from '@/components/desktop-chrome/desktop-chrome';
import { Input, Select } from '@/components/forms';
import { Toggle } from '@/components/toggle/toggle';
import { setPreviewHeaderHeight, setPreviewLogoVisible, setPreviewButtonStyle } from '@/utils/desktop-chrome';
import { SettingsItem } from '../settingsItem/settingsItem';
import styles from './desktop-preview-settings.module.css';

const minHeight = 36;
const maxHeight = 256;

export const DesktopButtonStyleSetting = () => {
  const { t } = useTranslation();
  const state = useDesktopChrome();
  if (state?.previewButtonStyle === undefined) {
    return null;
  }
  return (<SettingsItem
    settingName={t('desktopChrome.previewButtonStyle')}
    secondaryText={t('desktopChrome.previewButtonStyleDescription')}
    extraComponent={<Select
      id="desktop-button-style"
      aria-label={t('desktopChrome.previewButtonStyle')}
      value={state.previewButtonStyle}
      options={['system', 'linux', 'windows', 'macos'].map(value => ({ value, text: t(`desktopChrome.buttonStyles.${value}`) }))}
      onChange={event => setPreviewButtonStyle(event.target.value)}
    />}
  />);
};

export const DesktopHeaderHeightSetting = () => {
  const { t } = useTranslation();
  const state = useDesktopChrome();
  const height = state?.previewHeaderHeight;
  const [draft, setDraft] = useState<string>();
  if (height === undefined) {
    return null;
  }
  return (
    <SettingsItem
      settingName={t('desktopChrome.previewHeaderHeight')}
      secondaryText={t('desktopChrome.previewHeaderHeightDescription', { min: minHeight, max: maxHeight })}
      extraComponent={<Input
        className={styles.heightInput}
        type="number"
        aria-label={t('desktopChrome.previewHeaderHeight')}
        min={minHeight}
        max={maxHeight}
        step={1}
        required
        value={draft ?? height}
        onChange={event => {
          setDraft(event.currentTarget.value);
          if (event.currentTarget.validity.valid) {
            setPreviewHeaderHeight(event.currentTarget.valueAsNumber);
          }
        }}
        onBlur={() => setDraft(undefined)}
      />}
    />
  );
};

export const DesktopLogoSetting = () => {
  const { t } = useTranslation();
  const state = useDesktopChrome();
  if (state?.previewLogoVisible === undefined) {
    return null;
  }
  return (
    <SettingsItem
      settingName={t('desktopChrome.previewLogo')}
      secondaryText={t('desktopChrome.previewLogoDescription')}
      extraComponent={<Toggle
        aria-label={t('desktopChrome.previewLogo')}
        checked={state.previewLogoVisible}
        onChange={event => setPreviewLogoVisible(event.target.checked)}
      />}
    />
  );
};
