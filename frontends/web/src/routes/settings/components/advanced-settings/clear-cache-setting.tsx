// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clearCache } from '@/api/backend';
import { alertUser } from '@/components/alert/Alert';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';

export const ClearCacheSetting = () => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const closeDialog = () => {
    if (clearing) {
      return;
    }
    setDialogOpen(false);
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      const result = await clearCache();
      if (!result.success) {
        alertUser(result.errorMessage || t('genericError'));
        return;
      }
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      alertUser(t('genericError'));
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <SettingsItem
        settingName={t('settings.expert.clearCache.title')}
        secondaryText={t('settings.expert.clearCache.description')}
        onClick={() => setDialogOpen(true)}
      />
      <Dialog
        open={dialogOpen}
        onClose={clearing ? undefined : closeDialog}
        title={t('settings.expert.clearCache.dialog.title')}
        medium>
        <p>{t('settings.expert.clearCache.dialog.description')}</p>
        <p>{t('settings.expert.clearCache.dialog.note')}</p>
        <DialogButtons>
          <Button primary disabled={clearing} onClick={handleClearCache}>
            {t('settings.expert.clearCache.dialog.primaryCTA')}
          </Button>
          <Button secondary disabled={clearing} onClick={closeDialog}>
            {t('button.back')}
          </Button>
        </DialogButtons>
      </Dialog>
    </>
  );
};
