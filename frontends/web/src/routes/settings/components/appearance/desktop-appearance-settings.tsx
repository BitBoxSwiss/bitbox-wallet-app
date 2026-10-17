// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Accordion } from '@/components/accordion/accordion';
import { Button, Input, Select } from '@/components/forms';
import { useDarkmode } from '@/hooks/darkmode';
import { appearanceFields, appearanceValue, applyAppearance, mergeAppearance, readAppearance, saveAppearance, TAppearance } from '@/utils/desktop-appearance';
import { setPreviewButtonStyle, setPreviewHeaderHeight, setPreviewLogoVisible } from '@/utils/desktop-chrome';
import { SettingsItem } from '../settingsItem/settingsItem';
import { DesktopButtonStyleSetting, DesktopHeaderHeightSetting, DesktopLogoSetting } from './desktop-preview-settings';
import styles from './desktop-preview-settings.module.css';
import { DesktopAppearancePreview } from './desktop-appearance-preview';
import { NativeDecorationsSetting } from './native-decorations-setting';

const groups = ['colors', 'gradients', 'layout', 'shapes', 'effects', 'scrollbars', 'motion'];

export const DesktopAppearanceSettings = () => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const mode = isDarkMode ? 'dark' : 'light';
  const [profiles, setProfiles] = useState(readAppearance);
  const [saveFailed, setSaveFailed] = useState(false);
  const [draft, setDraft] = useState<{ id: string; value: string }>();
  useEffect(() => {
    const changed = () => setProfiles(readAppearance());
    window.addEventListener('bitbox-appearance-saved', changed);
    return () => window.removeEventListener('bitbox-appearance-saved', changed);
  }, []);
  const values = profiles[mode];
  const update = (next: TAppearance) => {
    setProfiles(mergeAppearance(profiles, mode, next));
    applyAppearance(next, mode);
    setSaveFailed(!saveAppearance(mode, next));
  };

  return (
    <section className={styles.playground} aria-label={t('desktopDesign.title')}>
      <p>{t('desktopDesign.description', { mode: t(`desktopDesign.${mode}`) })}</p>
      <div className={styles.actions}>
        <Button secondary onClick={() => {
          const lightSaved = saveAppearance('light', {});
          const darkSaved = saveAppearance('dark', {});
          setProfiles({ light: {}, dark: {} });
          applyAppearance({}, mode);
          setSaveFailed(!lightSaved || !darkSaved);
          setDraft(undefined);
          setPreviewHeaderHeight(48);
          setPreviewLogoVisible(true);
          setPreviewButtonStyle('system');
        }}>{t('desktopDesign.resetAll')}</Button>
        <Button secondary onClick={() => {
          const next = { ...values };
          appearanceFields.filter(field => field.type === 'color').forEach(field => delete next[field.id]);
          update(next);
          setDraft(undefined);
        }}>{t('desktopDesign.reset')}</Button>
      </div>
      {saveFailed && <p role="alert">{t('desktopDesign.saveFailed')}</p>}
      <Accordion className={styles.preview} title={t('desktopDesign.preview.title')} defaultOpen>
        <DesktopAppearancePreview />
      </Accordion>
      <Accordion className={styles.section} title={t('desktopDesign.header')}>
        <NativeDecorationsSetting />
        <DesktopButtonStyleSetting />
        <DesktopHeaderHeightSetting />
        <DesktopLogoSetting />
      </Accordion>
      {groups.map(group => (
        <Accordion key={group} className={styles.section} title={t(`desktopDesign.groups.${group}`)}>
          {group === 'shapes' && <p>{t('desktopDesign.shapesDescription')}</p>}
          {group === 'gradients' && <p>{t('desktopDesign.gradientsDescription')}</p>}
          {group === 'layout' && <p>{t('desktopDesign.layoutDescription')}</p>}
          {appearanceFields.filter(field => field.group === group).map(field => {
            const label = t(`desktopDesign.fields.${field.id}`);
            const value = appearanceValue(values, field, mode);
            return (
              <SettingsItem
                key={field.id}
                settingName={label}
                collapseOnSmall
                displayedValue={field.type === 'number' ? `${value}${field.unit}` : field.type === 'select' ? t(`desktopDesign.options.${value}`) : value}
                extraComponent={field.type === 'select' ? (
                  <Select
                    id={`desktop-design-${field.id}`}
                    aria-label={label}
                    value={value}
                    options={field.options.map(option => ({ value: option, text: t(`desktopDesign.options.${option}`) }))}
                    onChange={event => update({ ...values, [field.id]: event.target.value })}
                  />
                ) : (
                  <Input
                    className={styles.heightInput}
                    type={field.type === 'color' ? 'color' : 'number'}
                    aria-label={label}
                    value={draft?.id === `${mode}:${field.id}` ? draft.value : value}
                    {...(field.type === 'number' ? { min: field.min, max: field.max, step: field.step ?? 1, required: true } : {})}
                    onBlur={() => setDraft(undefined)}
                    onChange={event => {
                      setDraft({ id: `${mode}:${field.id}`, value: event.currentTarget.value });
                      if (event.currentTarget.validity.valid) {
                        update({ ...values, [field.id]: field.type === 'color' ? event.currentTarget.value : event.currentTarget.valueAsNumber });
                      }
                    }}
                  />
                )}
              />
            );
          })}
        </Accordion>
      ))}
    </section>
  );
};
