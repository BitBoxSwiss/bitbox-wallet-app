/**
 * Copyright 2023 Shift Crypto AG
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

import { Dispatch, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '../settingsItem/settingsItem';
import { ChevronRightDark } from '../../../../components/icon';
import { TBitcoinConfig } from '../../advanced-settings';
import styles from './enable-tor-proxy-setting.module.css';
import { ExplorerDialog } from './explorer-dialog';
import InlineMessage from '../../../../components/inlineMessage/InlineMessage';

type TProps = {
    bitcoinConfig?: TBitcoinConfig;
    onChangeConfig: Dispatch<any>;
}

export const EnableExplorerSetting = ({ bitcoinConfig, onChangeConfig }: TProps) => {
  const { t } = useTranslation();
  const [showExplorerDialog, setShowExplorerDialog] = useState(false);
  const [showRestartMessage, setShowRestartMessage] = useState(false);

  const explorerEnabled = bitcoinConfig?.explorer ? bitcoinConfig.explorer.useCustomBlockExplorer : false;

  return (
    <>
      {
        showRestartMessage ?
          <InlineMessage
            type="success"
            align="left"
            message={t('settings.restart')}
            onEnd={() => setShowRestartMessage(false)}
          /> : null
      }
      <SettingsItem
        className={styles.settingItem}
        settingName={t('settings.expert.useCustomBlockExplorer')}
        onClick={() => setShowExplorerDialog(true)}
        secondaryText={t('newSettings.advancedSettings.explorer.description')}
        displayedValue={explorerEnabled ? t('generic.enabled_true') : t('generic.enabled_false')}
        extraComponent={<ChevronRightDark width={24} height={24} />}
      />
      <ExplorerDialog
        open={showExplorerDialog}
        bitcoinConfig={bitcoinConfig}
        onCloseDialog={() => setShowExplorerDialog(false)}
        onChangeConfig={onChangeConfig}
        handleShowRestartMessage={setShowRestartMessage}
      />
    </>
  );
};