/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CoinCode, IAccount } from '@/api/account';
import * as backendAPI from '@/api/backend';
import { i18n } from '@/i18n/i18n';
import { Guide } from '@/components/guide/guide';
import { Entry } from '@/components/guide/entry';
import { Button, ButtonLink } from '@/components/forms';
import { Header } from '@/components/layout';
import { getConfig, setConfig } from '@/utils/config';
import { MobileHeader } from './components/mobile-header';
import { BlockExplorers } from './block-explorers';

type TSelectExplorerSettingsProps = {
  accounts: IAccount[];
}

export const SelectExplorerSettings = ({ accounts }: TSelectExplorerSettingsProps) => {
  const { t } = useTranslation();

  const initialConfig = useRef<any>();
  const [config, setConfigState] = useState<any>();

  const availableCoins = new Set(accounts.map(account => account.coinCode));
  const [allSelections, setAllSelections] = useState<backendAPI.TAvailableExplorers>();

  const [saveDisabled, setSaveDisabled] = useState(true);

  const loadConfig = () => {
    getConfig().then(setConfigState);
  };


  const updateConfigState = useCallback((newConfig: any) => {
    if (JSON.stringify(initialConfig.current) !== JSON.stringify(newConfig)) {
      setConfigState(newConfig);
      setSaveDisabled(false);
    } else {
      setSaveDisabled(true);
    }
  }, []);

  const handleChange = useCallback((selectedTxPrefix: string, coin: CoinCode) => {
    if (config.backend.blockExplorers[coin] && config.backend.blockExplorers[coin] !== selectedTxPrefix) {
      config.backend.blockExplorers[coin] = selectedTxPrefix;
      updateConfigState(config);
    }
  }, [config, updateConfigState]);

  const save = async () => {
    setSaveDisabled(true);
    await setConfig(config);
    initialConfig.current = await getConfig();
  };

  useEffect(() => {
    const fetchData = async () => {
      const allExplorerSelection = await backendAPI.getAvailableExplorers();

      // if set alongside config it will 'update' with it, but we want it to stay the same after initialization.
      initialConfig.current = await getConfig();

      setAllSelections(allExplorerSelection);
    };

    loadConfig();
    fetchData().catch(console.error);
  }, []);

  if (config === undefined) {
    return null;
  }

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header
            hideSidebarToggler
            title={
              <>
                <h2 className={'hide-on-small'}>{t('settings.expert.explorer.title')}</h2>
                <MobileHeader withGuide title={t('settings.expert.explorer.title')}/>
              </>
            }/>
          <div className="content padded">
            { Array.from(availableCoins).map(coin => {
              return <BlockExplorers
                key={coin}
                coin={coin}
                explorerOptions={allSelections?.[coin] ?? []}
                handleOnChange={handleChange}
                selectedPrefix={config.backend.blockExplorers?.[coin]}/>;
            }) }
          </div>
          <div className="content padded" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <ButtonLink
              secondary
              className={'hide-on-small'}
              to={'/settings'}>
              {t('button.back')}
            </ButtonLink>
            <Button primary disabled={saveDisabled} onClick={() => save()}>{t('settings.save')}</Button>
          </div>
        </div>
      </div>
      <Guide>
        <Entry key="guide.settingsBlockExplorer.what" entry={t('guide.settingsBlockExplorer.what', { returnObjects: true })} />
        <Entry key="guide.settingsBlockExplorer.why" entry={t('guide.settingsBlockExplorer.why', { returnObjects: true })} />
        <Entry key="guide.settingsBlockExplorer.options" entry={t('guide.settingsBlockExplorer.options', { returnObjects: true })} />
        <Entry key="guide.settings-electrum.instructions" entry={{
          link: {
            text: t('guide.settingsBlockExplorer.instructions.link.text'),
            url: (i18n.resolvedLanguage === 'de')
            // TODO: DE guide.
              ? 'https://shiftcrypto.support/help/en-us/23-bitcoin/205-how-to-use-a-block-explorer'
              : 'https://shiftcrypto.support/help/en-us/23-bitcoin/205-how-to-use-a-block-explorer'
          },
          text: t('guide.settingsBlockExplorer.instructions.text'),
          title: t('guide.settingsBlockExplorer.instructions.title')
        }} />
      </Guide>
    </div>
  );
};
