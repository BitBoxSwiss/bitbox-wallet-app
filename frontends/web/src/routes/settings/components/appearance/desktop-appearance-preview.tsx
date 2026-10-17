// SPDX-License-Identifier: Apache-2.0

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Input, Radio, Select } from '@/components/forms';
import { Toggle } from '@/components/toggle/toggle';
import { SettingsItem } from '../settingsItem/settingsItem';
import styles from './desktop-preview-settings.module.css';

export const DesktopAppearancePreview = () => {
  const { t } = useTranslation();
  const id = useId();
  const [enabled, setEnabled] = useState(true);
  return (
    <section aria-label={t('desktopDesign.preview.title')}>
      <p>{t('desktopDesign.preview.description')}</p>
      <SettingsItem
        settingName={t('desktopDesign.preview.switch')}
        secondaryText={t('desktopDesign.preview.secondaryText')}
        extraComponent={<Toggle aria-label={t('desktopDesign.preview.switch')} checked={enabled} onChange={event => setEnabled(event.target.checked)} />}
      />
      <div className={styles.previewGrid}>
        <Button primary onClick={() => setEnabled(!enabled)}>{t('desktopDesign.preview.primary')}</Button>
        <Button secondary>{t('desktopDesign.preview.secondary')}</Button>
        <Button primary disabled>{t('desktopDesign.preview.disabled')}</Button>
        <div>{t('desktopDesign.preview.disabledSwitch')} <Toggle aria-label={t('desktopDesign.preview.disabledSwitch')} disabled defaultChecked /></div>
        <Input id={`${id}-input`} label={t('desktopDesign.preview.input')} placeholder={t('desktopDesign.preview.placeholder')} />
        <Select id={`${id}-select`} label={t('desktopDesign.preview.select')} options={['first', 'second'].map(value => ({ value, text: t(`desktopDesign.preview.${value}`) }))} />
        <Checkbox id={`${id}-checkbox`} label={t('desktopDesign.preview.checkbox')} defaultChecked />
        <div>
          <Radio id={`${id}-radio-first`} name={`${id}-radio`} label={t('desktopDesign.preview.first')} defaultChecked />
          <Radio id={`${id}-radio-second`} name={`${id}-radio`} label={t('desktopDesign.preview.second')} />
        </div>
      </div>
    </section>
  );
};
