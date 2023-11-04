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

import { useTranslation } from 'react-i18next';
import { Dispatch, useEffect, useState } from 'react';
import { Dialog, DialogButtons } from '../../../../components/dialog/dialog';
import { Toggle } from '../../../../components/toggle/toggle';
import { Button, Input } from '../../../../components/forms';
import { setConfig } from '../../../../utils/config';
import { TConfig, TBitcoinExplorerConfig, TBitcoinConfig } from '../../advanced-settings';
import { debug } from '../../../../utils/env';
import { useLoad } from '../../../../hooks/api';
import { getTesting } from '../../../../api/backend';

type TProps = {
    open: boolean;
    bitcoinConfig?: TBitcoinConfig;
    onCloseDialog: () => void;
    onChangeConfig: (config: any) => void;
    handleShowRestartMessage: Dispatch<boolean>;
}

export const ExplorerDialog = ({ open, bitcoinConfig, onCloseDialog, onChangeConfig, handleShowRestartMessage }: TProps) => {
  const testing = useLoad(debug ? getTesting : () => Promise.resolve(false));
  const [explorerURL, setExplorerURL] = useState<string>();
  const { t } = useTranslation();

  useEffect(() => {
    if (bitcoinConfig?.explorer) {
      setExplorerURL(bitcoinConfig.explorer.explorerURL);
    }
  }, [bitcoinConfig]);


  const handleSetExplorerButton = async () => {
    if (!bitcoinConfig?.explorer || explorerURL === undefined) {
      return;
    }
    const explorer = bitcoinConfig.explorer;
    explorer.explorerURL = explorerURL.trim();

    // TODO: Validate that the URL can be reached. Because of CORS we would need to make a request to the backen.
    // this is not super important as the user gets the same feedback when the link can't be opened later.
    await setExplorerConfig(explorer);
  };

  const setExplorerConfig = async (explorerConfig: TBitcoinExplorerConfig) => {
    const config = await setConfig({
      backend: { ...(testing ? { tbtc: { ...bitcoinConfig, explorer: explorerConfig } } : { btc: { ...bitcoinConfig, explorer: explorerConfig } }) },
    }) as TConfig;

    setExplorerURL(explorerConfig.explorerURL);
    onChangeConfig(config);
    handleShowRestartMessage(true);
  };

  const handleToggleExplorer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!bitcoinConfig) {
      return;
    }
    const explorer = { ...bitcoinConfig.explorer, useCustomBlockExplorer: e.target.checked };
    await setExplorerConfig(explorer);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExplorerURL(e.target.value);
    handleShowRestartMessage(false);
  };

  // if no config nor explorerURL
  if (!bitcoinConfig?.explorer || explorerURL === undefined) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onCloseDialog} title={t('settings.expert.setBlockExplorerURL')} small>
      <div className="flex flex-row flex-between flex-items-center">
        <p className="m-none">{t('settings.expert.useCustomBlockExplorer')}</p>
        <Toggle
          id="useCustomBlockExplorer"
          checked={bitcoinConfig.explorer.useCustomBlockExplorer}
          onChange={handleToggleExplorer} />
      </div>
      <div className="m-top-half">
        <Input
          name="explorerURL"
          onInput={handleInputChange}
          value={explorerURL}
          placeholder={testing ? 'https://blockstream.info/testnet/tx/' : 'https://blockstream.info/tx/'}
          disabled={!bitcoinConfig.explorer.useCustomBlockExplorer}
        />
        <DialogButtons>
          <Button primary
            onClick={handleSetExplorerButton}
            disabled={!bitcoinConfig.explorer.useCustomBlockExplorer || explorerURL === bitcoinConfig.explorer.explorerURL}>
            {t('settings.expert.setBlockExplorerURL')}
          </Button>
        </DialogButtons>
      </div>
    </Dialog>
  );
};