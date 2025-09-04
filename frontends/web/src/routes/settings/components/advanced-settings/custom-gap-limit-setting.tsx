/**
 * Copyright 2025 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { NumberInput } from '@/components/forms/input-number';
import { setConfig } from '@/utils/config';
import type { TBackendConfig, TConfig } from '@/routes/settings/advanced-settings';

type TProps = {
  backendConfig?: TBackendConfig;
  onChangeConfig: (config: TConfig) => void;
}

export const CustomGapLimitSettings = ({ backendConfig, onChangeConfig }: TProps) => {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);

  const DEFAULT_GAP_LIMIT_RECEIVE = 20;
  const DEFAULT_GAP_LIMIT_CHANGE = 6;

  const [gapLimitReceive, setGapLimitReceive] = useState(backendConfig?.gapLimitReceive || DEFAULT_GAP_LIMIT_RECEIVE);
  const [gapLimitChange, setGapLimitChange] = useState(backendConfig?.gapLimitChange || DEFAULT_GAP_LIMIT_CHANGE);

  useEffect(() => {
    if (backendConfig) {
      setGapLimitReceive(backendConfig.gapLimitReceive || DEFAULT_GAP_LIMIT_RECEIVE);
      setGapLimitChange(backendConfig.gapLimitChange || DEFAULT_GAP_LIMIT_CHANGE);
    }
  }, [backendConfig]);

  const handleSave = async () => {
    const config = await setConfig({
      backend: {
        ...backendConfig,
        gapLimitReceive,
        gapLimitChange,
      },
    }) as TConfig;
    onChangeConfig(config);
    setShowDialog(false);
  };

  return (
    <>
      <SettingsItem
        settingName={t('gapLimit.title')}
        secondaryText={t('gapLimit.description')}
        onClick={() => setShowDialog(true)}
      />
      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        title={t('gapLimit.title')}
        small>
        <div className="columnsContainer half">
          <div className="columns half">
            <div className="column">
              <NumberInput
                label={t('gapLimit.receive')}
                value={gapLimitReceive}
                onChange={(e) => setGapLimitReceive(Number((e.target as HTMLInputElement).value) || DEFAULT_GAP_LIMIT_RECEIVE)}
                error={gapLimitReceive < DEFAULT_GAP_LIMIT_RECEIVE ? t('gapLimit.minValue', { min: DEFAULT_GAP_LIMIT_RECEIVE }) : undefined}
              />
            </div>
            <div className="column">
              <NumberInput
                label={t('gapLimit.change')}
                value={gapLimitChange}
                onChange={(e) => setGapLimitChange(parseInt((e.target as HTMLInputElement).value, 10) || DEFAULT_GAP_LIMIT_CHANGE)}
                error={gapLimitChange < DEFAULT_GAP_LIMIT_CHANGE ? t('gapLimit.minValue', { min: DEFAULT_GAP_LIMIT_CHANGE }) : undefined}
              />
            </div>
            <div>
              <Button
                onClick={() => {
                  setGapLimitReceive(DEFAULT_GAP_LIMIT_RECEIVE);
                  setGapLimitChange(DEFAULT_GAP_LIMIT_CHANGE);
                }}
                transparent
                style={{ paddingLeft: '0' }}>
                {t('gapLimit.resetToDefault')}
              </Button>
            </div>
          </div>
        </div>
        <DialogButtons>
          <Button
            primary
            disabled={gapLimitReceive < DEFAULT_GAP_LIMIT_RECEIVE || gapLimitChange < DEFAULT_GAP_LIMIT_CHANGE}
            onClick={handleSave}>
            {t('button.save')}
          </Button>
          <Button
            secondary
            onClick={() => setShowDialog(false)}>
            {t('button.cancel')}
          </Button>
        </DialogButtons>
      </Dialog>
    </>
  );
};