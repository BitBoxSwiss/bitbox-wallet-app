// SPDX-License-Identifier: Apache-2.0

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Input, Radio, Select } from '@/components/forms';
import { Toggle } from '@/components/toggle/toggle';
import styles from './desktop-preview-settings.module.css';

export const DesktopAppearancePreview = () => {
  const { t } = useTranslation();
  const id = useId();
  const [enabled, setEnabled] = useState(true);
  return (
    <section aria-label={t('desktopDesign.preview.title')}>
      <p>{t('desktopDesign.preview.description')}</p>
      <div className={styles.previewGrid}>
        <Button primary onClick={() => setEnabled(!enabled)}>{t('desktopDesign.preview.primary')}</Button>
        <Button secondary>{t('desktopDesign.preview.secondary')}</Button>
        <Button primary disabled>{t('desktopDesign.preview.disabled')}</Button>
        <div className={styles.previewSwitch}>
          {t('desktopDesign.preview.switch')}
          <Toggle aria-label={t('desktopDesign.preview.switch')} checked={enabled} onChange={event => setEnabled(event.target.checked)} />
        </div>
      </div>
      <div className={styles.previewFields}>
        <Input id={`${id}-input`} label={t('desktopDesign.preview.input')} placeholder={t('desktopDesign.preview.placeholder')} />
        <Select id={`${id}-select`} label={t('desktopDesign.preview.select')} options={['first', 'second'].map(value => ({ value, text: t(`desktopDesign.preview.${value}`) }))} />
      </div>
      <div className={styles.previewGrid}>
        <Checkbox id={`${id}-checkbox`} label={t('desktopDesign.preview.checkbox')} defaultChecked />
        <div>
          <Radio id={`${id}-radio-first`} name={`${id}-radio`} label={t('desktopDesign.preview.first')} defaultChecked />
          <Radio id={`${id}-radio-second`} name={`${id}-radio`} label={t('desktopDesign.preview.second')} />
        </div>
        <span className={styles.previewSecondary}>{t('desktopDesign.preview.secondaryText')}</span>
      </div>
    </section>
  );
};
