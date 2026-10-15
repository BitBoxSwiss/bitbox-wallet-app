// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useDesktopChrome } from '@/components/desktop-chrome/desktop-chrome';
import { Toggle } from '@/components/toggle/toggle';
import { setNativeDecorations } from '@/utils/desktop-chrome';
import { SettingsItem } from '../settingsItem/settingsItem';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';

export const NativeDecorationsSetting = () => {
  const { t } = useTranslation();
  const state = useDesktopChrome();
  const [restartShown, setRestartShown] = useState(false);
  if (!state) {
    return null;
  }
  return (
    <>
      <SettingsItem
        settingName={t('desktopChrome.nativeDecorations')}
        secondaryText={t(state.nativeDecorations !== state.activeNativeDecorations ? 'settings.restart' : 'desktopChrome.restart')}
        extraComponent={<Toggle checked={state.nativeDecorations} onChange={event => {
          setNativeDecorations(event.target.checked);
          setRestartShown(event.target.checked !== state.activeNativeDecorations);
        }} />}
      />
      <Dialog open={restartShown} onClose={() => setRestartShown(false)} title={t('settings.restart')}>
        <DialogButtons>
          <Button primary onClick={() => setRestartShown(false)}>{t('button.ok')}</Button>
        </DialogButtons>
      </Dialog>
    </>
  );
};
