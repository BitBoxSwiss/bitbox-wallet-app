// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Accordion } from '@/components/accordion/accordion';
import { Button, Input, Select } from '@/components/forms';
import { useDarkmode } from '@/hooks/darkmode';
import { appearanceFields, gradientTargets, appearanceValue, applyAppearance, mergeAppearance, readAppearance, saveAppearance, TAppearance } from '@/utils/desktop-appearance';
import { setPreviewButtonStyle, setPreviewHeaderHeight, setPreviewLogoVisible, setPreviewSeparateTitlebar, setNativeDecorations } from '@/utils/desktop-chrome';
import { SettingsItem } from '../settingsItem/settingsItem';
import { DesktopButtonStyleSetting, DesktopHeaderHeightSetting, DesktopLogoSetting, DesktopSeparateTitlebarSetting } from './desktop-preview-settings';
import styles from './desktop-preview-settings.module.css';
import { DesktopAppearancePreview } from './desktop-appearance-preview';
import { NativeDecorationsSetting } from './native-decorations-setting';

const groups = ['main', 'sidebar', 'guide', 'button', 'card', 'input', 'switch', 'effects', 'scrollbars', 'motion'];

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

  const renderFields = (group: string, gradients = false) => appearanceFields
    .filter(field => field.group === group && field.id.includes('Gradient') === gradients)
    .map(field => {
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
    });

  return (
    <section className={styles.playground} aria-label={t('desktopDesign.title')}>
      <p>{t('desktopDesign.description', { mode: t(`desktopDesign.${mode}`) })}</p>
      <p>{t('desktopDesign.defaultsDescription')}</p>
      <div className={styles.actions}>
        <Button secondary onClick={() => {
          const lightSaved = saveAppearance('light', {});
          const darkSaved = saveAppearance('dark', {});
          setProfiles({ light: {}, dark: {} });
          applyAppearance({}, mode);
          setSaveFailed(!lightSaved || !darkSaved);
          setDraft(undefined);
          setPreviewHeaderHeight(70);
          setNativeDecorations(true);
          setPreviewSeparateTitlebar(false);
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
        <DesktopSeparateTitlebarSetting />
        <DesktopHeaderHeightSetting />
        <DesktopLogoSetting />
      </Accordion>
      {groups.map(group => (
        <Accordion key={group} className={styles.section} title={t(`desktopDesign.groups.${group}`)}>
          {group === 'scrollbars' && <p>{t('desktopDesign.scrollbarsDescription')}</p>}
          {group === 'button' && <p>{t('desktopDesign.shapesDescription')}</p>}
          {group === 'sidebar' && <p>{t('desktopDesign.layoutDescription')}</p>}
          {renderFields(group)}
          {gradientTargets.some(target => target === group) && (
            <Accordion className={styles.subsection} title={t('desktopDesign.groups.gradients')}>
              <p>{t('desktopDesign.gradientsDescription')}</p>
              {renderFields(group, true)}
            </Accordion>
          )}
        </Accordion>
      ))}
    </section>
  );
};
