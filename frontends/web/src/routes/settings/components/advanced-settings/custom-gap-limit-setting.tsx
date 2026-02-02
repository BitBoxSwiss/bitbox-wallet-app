// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button, Input } from '@/components/forms';
import { setConfig } from '@/utils/config';
import type { TBackendConfig, TConfig } from '@/routes/settings/advanced-settings';
import { Message } from '@/components/message/message';
import { useMediaQuery } from '@/hooks/mediaquery';

type TProps = {
  backendConfig?: TBackendConfig;
  onChangeConfig: (config: TConfig) => void;
};

export const CustomGapLimitSettings = ({ backendConfig, onChangeConfig }: TProps) => {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const DEFAULT_GAP_LIMIT_RECEIVE = 20;
  const DEFAULT_GAP_LIMIT_CHANGE = 6;
  const MAX_LIMIT = 2000;

  const [showRestartMessage, setShowRestartMessage] = useState(false);
  const [gapLimitReceive, setGapLimitReceive] = useState<number | string>(backendConfig?.gapLimitReceive || DEFAULT_GAP_LIMIT_RECEIVE);
  const [gapLimitChange, setGapLimitChange] = useState<number | string>(backendConfig?.gapLimitChange || DEFAULT_GAP_LIMIT_CHANGE);

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
    });
    onChangeConfig(config);
    setShowDialog(false);
  };

  const getGapLimitError = (value: number | string, min: number) => {
    if (typeof value !== 'number') {
      return undefined;
    }
    if (value < min) {
      return t('gapLimit.minValue', { min });
    }
    if (value > MAX_LIMIT) {
      return t('gapLimit.maxValue', { max: MAX_LIMIT });
    }
    return undefined;
  };

  return (
    <>
      {showRestartMessage ? (
        <Message type="warning">
          {t('settings.restart')}
        </Message>
      ) : null}
      <SettingsItem
        settingName={t('gapLimit.title')}
        secondaryText={t('gapLimit.description')}
        onClick={() => setShowDialog(true)}
      />
      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        title={t('gapLimit.title')}
        medium>
        <Input
          autoFocus={!isMobile}
          type="number"
          label={t('gapLimit.receive')}
          id="gapLimitReceive"
          onInput={(e: ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setGapLimitReceive(value === '' ? '' : parseInt(value, 10) || DEFAULT_GAP_LIMIT_RECEIVE);
          }}
          value={gapLimitReceive}
          error={getGapLimitError(gapLimitReceive, DEFAULT_GAP_LIMIT_RECEIVE)}
        />
        <Input
          type="number"
          label={t('gapLimit.change')}
          id="gapLimitChange"
          onInput={(e: ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;
            setGapLimitChange(value === '' ? '' : parseInt(value, 10) || DEFAULT_GAP_LIMIT_CHANGE);
          }}
          value={gapLimitChange}
          error={getGapLimitError(gapLimitChange, DEFAULT_GAP_LIMIT_CHANGE)}
        />
        <Button
          onClick={() => {
            setGapLimitReceive(DEFAULT_GAP_LIMIT_RECEIVE);
            setGapLimitChange(DEFAULT_GAP_LIMIT_CHANGE);
          }}
          transparent
          style={{ paddingLeft: '0' }}>
          {t('generic.resetToDefault')}
        </Button>
        <DialogButtons>
          <Button
            primary
            disabled={
              (typeof gapLimitReceive === 'string' && gapLimitReceive === '') ||
              (typeof gapLimitChange === 'string' && gapLimitChange === '') ||
              (typeof gapLimitReceive === 'number' && gapLimitReceive < DEFAULT_GAP_LIMIT_RECEIVE) ||
              (typeof gapLimitChange === 'number' && gapLimitChange < DEFAULT_GAP_LIMIT_CHANGE) ||
              (typeof gapLimitReceive === 'number' && gapLimitReceive > MAX_LIMIT) ||
              (typeof gapLimitChange === 'number' && gapLimitChange > MAX_LIMIT)
            }
            onClick={() => {
              handleSave();
              setShowRestartMessage(true);
            }}>
            {t('dialog.confirm')}
          </Button>
          <Button
            secondary
            onClick={() => setShowDialog(false)}>
            {t('dialog.cancel')}
          </Button>
        </DialogButtons>
      </Dialog>
    </>
  );
};