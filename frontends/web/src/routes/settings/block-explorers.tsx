/**
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

import { CoinCode } from '@/api/account';
import { TBlockExplorer } from '@/api/backend';
import { SingleDropdown } from './components/dropdowns/singledropdown';

type TOption = {
    label: string;
    value: string;
}

type TProps = {
    coin: CoinCode;
    explorerOptions: TBlockExplorer[];
    handleOnChange: (value: string, coin: CoinCode) => void
    selectedPrefix: string;
};

export const BlockExplorers = ({ coin, explorerOptions, handleOnChange, selectedPrefix }: TProps) => {
  const options: TOption[] = explorerOptions.map(explorer => {
    return { label: explorer.name, value: explorer.url };
  });

  const fullCoinName = new Map<CoinCode, string>([
    ['btc', 'Bitcoin'],
    ['tbtc', 'Testnet Bitcoin'],
    ['ltc', 'Litecoin'],
    ['tltc', 'Testnet Litecoin'],
    ['eth', 'Ethereum'],
    ['goeth', 'Goerli Ethereum'],
    ['sepeth', 'Sepolia Ethereum'],
  ]);

  // find the index of the currently selected explorer. will be -1 if none is found.
  const activeExplorerIndex = explorerOptions.findIndex(explorer => explorer.url === selectedPrefix);

  return (
    options.length > 0 &&
    <div>
      <h2>{fullCoinName.get(coin)}</h2>
      <SingleDropdown
        options={options}
        handleChange={value => handleOnChange(value, coin)}
        value={options[activeExplorerIndex > 0 ? activeExplorerIndex : 0]}
      />
    </div>
  );
};
