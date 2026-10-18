// SPDX-License-Identifier: Apache-2.0

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/forms';
import { useMountedRef } from '@/hooks/mount';
import { parseAppearancePreset, presetSizeLimit, serializeAppearancePreset, TAppearancePreset, TAppearanceProfiles } from '@/utils/desktop-appearance';
import { saveDesktopAppearancePreset } from '@/utils/transport-qt';
import styles from './desktop-preview-settings.module.css';

type TProps = { profiles: TAppearanceProfiles; onImport: (preset: TAppearancePreset) => boolean };

export const DesktopAppearancePresets = ({ profiles, onImport }: TProps) => {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const apply = useRef(onImport);
  apply.current = onImport;
  const mounted = useMountedRef();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ key: string; error?: boolean }>();
  return (<>
    <div className={styles.actions}>
      <Button secondary disabled={busy} onClick={async () => {
        setBusy(true);
        try {
          const result = await saveDesktopAppearancePreset(serializeAppearancePreset(profiles), t('desktopDesign.presets.export'));
          if (mounted.current) {
            setMessage(result === 'cancelled' ? undefined : { key: `desktopDesign.presets.${result}`, error: result === 'error' });
          }
        } catch {
          if (mounted.current) {
            setMessage({ key: 'desktopDesign.presets.error', error: true });
          }
        } finally {
          if (mounted.current) {
            setBusy(false);
          }
        }
      }}>{t('desktopDesign.presets.export')}</Button>
      <Button secondary disabled={busy} onClick={() => input.current?.click()}>{t('desktopDesign.presets.import')}</Button>
      <input ref={input} type="file" hidden accept=".json,application/json" aria-label={t('desktopDesign.presets.import')} onChange={async event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) {
          return;
        }
        setBusy(true);
        try {
          if (file.size > presetSizeLimit) {
            throw new Error('Preset too large');
          }
          const preset = parseAppearancePreset(await file.text());
          if (mounted.current) {
            const saved = apply.current(preset);
            setMessage({ key: saved ? 'desktopDesign.presets.imported' : 'desktopDesign.saveFailed', error: !saved });
          }
        } catch {
          if (mounted.current) {
            setMessage({ key: 'desktopDesign.presets.invalid', error: true });
          }
        } finally {
          if (mounted.current) {
            setBusy(false);
          }
        }
      }} />
    </div>
    {message && <p role={message.error ? 'alert' : 'status'}>{t(message.key)}</p>}
  </>);
};
