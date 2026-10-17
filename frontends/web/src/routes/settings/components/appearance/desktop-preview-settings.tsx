// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useDesktopChrome } from '@/components/desktop-chrome/desktop-chrome';
import { Input } from '@/components/forms';
import { Toggle } from '@/components/toggle/toggle';
import { setPreviewHeaderHeight, setPreviewLogoVisible } from '@/utils/desktop-chrome';
import { SettingsItem } from '../settingsItem/settingsItem';
import styles from './desktop-preview-settings.module.css';

const minHeight = 36;
const maxHeight = 256;

export const DesktopHeaderHeightSetting = () => {
  const { t } = useTranslation();
  const state = useDesktopChrome();
  const height = state?.previewHeaderHeight;
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
        defaultValue={height}
        onChange={event => {
          if (event.currentTarget.validity.valid) {
            setPreviewHeaderHeight(event.currentTarget.valueAsNumber);
          }
        }}
        onBlur={event => {
          if (!event.currentTarget.validity.valid) {
            event.currentTarget.value = String(height);
          }
        }}
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
