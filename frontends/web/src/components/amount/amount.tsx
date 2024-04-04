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

import { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { CoinUnit, ConversionUnit } from './../../api/account';
import { i18n } from '../../i18n/i18n';
import style from './amount.module.css';

type TProps = {
  amount: string;
  unit: CoinUnit | ConversionUnit;
  removeBtcTrailingZeroes?: boolean;
  alwaysShowAmounts?: boolean
};

const formatSats = (amount: string): JSX.Element => {
  const blocks: JSX.Element[] = [];
  const blockSize = 3;

  for (let i = amount.length; i > 0 ; i -= blockSize) {
    const start = Math.max(0, i - blockSize);

    blocks.push(
      <span
        key={'block_' + blocks.length}
        className={start === 0 ? '' : style.space}>
        {amount.slice(start, i)}
      </span>
    );
  }

  return (
    <span data-testid="amountBlocks">
      {blocks.reverse()}
    </span>
  );
};

const formatBtc = (amount: string) => {
  const dot = amount.indexOf('.');
  if (dot === -1) {
    return amount;
  }
  return (
    <span data-testid="amountBlocks">
      <span>
        {amount.slice(0, dot + 3)}
      </span>
      <span className={style.space}>
        {amount.slice(dot + 3, dot + 6)}
      </span>
      <span className={style.space}>
        {amount.slice(dot + 6, dot + 9)}
      </span>
    </span>
  );
};

const coins = ['BTC', 'sat', 'LTC', 'ETH', 'TBTC', 'tsat', 'TLTC', 'GOETH', 'SEPETH'];
const tokens = ['BAT', 'DAI', 'LINK', 'MKR', 'PAXG', 'USDC', 'USDT', 'WBTC', 'ZRX'];
const isCoinOrToken = (unit: string) => coins.includes(unit) || tokens.includes(unit);

export const Amount = ({
  amount,
  unit,
  removeBtcTrailingZeroes,
  alwaysShowAmounts = false,
}: TProps) => {
  const { hideAmounts } = useContext(AppContext);

  if (hideAmounts && !alwaysShowAmounts) {
    return '***';
  }

  switch (unit) {
  case 'BTC':
  case 'TBTC':
  case 'LTC':
  case 'TLTC':
    if (removeBtcTrailingZeroes && amount.includes('.')) {
      return amount.replace(/\.?0+$/, '');
    } else {
      return formatBtc(amount);
    }
  case 'sat':
  case 'tsat':
    return formatSats(amount);
  }

  if (isCoinOrToken(unit)) { // don't touch coins/tokens for now
    return amount;
  }

  // const NumberFormat = Intl
  //   .NumberFormat(
  //     i18n.language,
  //     { style: 'currency', currency: unit }
  //   );

  // const formatted = NumberFormat
  //   .formatToParts(
  //     Number(amount.replace(/[']/g, '')) // scary js number conversion
  //   )
  //   .filter(x => !['currency', 'literal'].includes(x.type)) // only use formatte amount and drop the currency
  //   .map(x => x.value)
  //   .join('');

  // return formatted;

  switch (i18n.language.slice(0, 2)) {
  case 'de':
  case 'es':
  case 'id':
  case 'nl':
  case 'pt':
  case 'tr':
    if (i18n.language.slice(3, 5) === 'CH') {
      return amount.replace(/[']/g, '’');
    }
    return (
      amount
        .replace(/[.]/g, ',')
        .replace(/[']/g, '.')
    );
  case 'en':
  case 'ja':
  case 'ko':
  case 'zh':
    return amount.replace(/[']/g, ',');
  case 'fr':
  case 'ru':
    return (
      amount
        .replace(/[']/g, ' ')
        .replace(/[.]/g, ',')
    );
  }
  return amount;

};
