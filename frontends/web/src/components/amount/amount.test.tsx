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

import { render } from '@testing-library/react';
import { Amount } from './amount';
import { CoinUnit, ConversionUnit } from './../../api/account';

describe('Amount formatting', () => {

  describe('sat amounts', () => {
    let coins: CoinUnit[] = ['sat', 'tsat'];
    coins.forEach(coin => {
      it('12345678901234 ' + coin + ' with removeBtcTrailingZeroes enabled gets spaced', () => {
        const { getByTestId } = render(<Amount amount="12345678901234" unit={coin} removeBtcTrailingZeroes/>);
        const blocks = getByTestId('amountBlocks');
        expect(blocks.innerHTML).toBe(
          '<span class="">12</span>' +
          '<span class="space">345</span>' +
          '<span class="space">678</span>' +
          '<span class="space">901</span>' +
          '<span class="space">234</span>');
      });

      it('1234567 ' + coin + ' with removeBtcTrailingZeroes enabled gets spaced', () => {
        const { getByTestId } = render(<Amount amount="1234567" unit={coin} removeBtcTrailingZeroes/>);
        const blocks = getByTestId('amountBlocks');
        expect(blocks.innerHTML).toBe(
          '<span class="">1</span>' +
          '<span class="space">234</span>' +
          '<span class="space">567</span>');
      });

      it('12345 ' + coin + ' with removeBtcTrailingZeroes enabled gets spaced', () => {
        const { getByTestId } = render(<Amount amount="12345" unit={coin} removeBtcTrailingZeroes/>);
        const blocks = getByTestId('amountBlocks');
        expect(blocks.innerHTML).toBe(
          '<span class="">12</span>' +
          '<span class="space">345</span>');
      });

      it('21 ' + coin + ' with removeBtcTrailingZeroes enabled gets spaced', () => {
        const { getByTestId } = render(<Amount amount="21" unit={coin} removeBtcTrailingZeroes/>);
        const blocks = getByTestId('amountBlocks');
        expect(blocks.innerHTML).toBe('<span class="">21</span>');
      });

      it('12345678901234 ' + coin + ' with removeBtcTrailingZeroes disabled gets spaced', () => {
        const { getByTestId } = render(<Amount amount="12345678901234" unit={coin}/>);
        const blocks = getByTestId('amountBlocks');
        expect(blocks.innerHTML).toBe(
          '<span class="">12</span>' +
          '<span class="space">345</span>' +
          '<span class="space">678</span>' +
          '<span class="space">901</span>' +
          '<span class="space">234</span>');
      });

      it('1234567 ' + coin + ' with removeBtcTrailingZeroes disabled gets spaced', () => {
        const { getByTestId } = render(<Amount amount="1234567" unit={coin}/>);
        const blocks = getByTestId('amountBlocks');
        expect(blocks.innerHTML).toBe(
          '<span class="">1</span>' +
          '<span class="space">234</span>' +
          '<span class="space">567</span>');
      });

      it('12345 ' + coin + ' with removeBtcTrailingZeroes disabled gets spaced', () => {
        const { getByTestId } = render(<Amount amount="12345" unit={coin}/>);
        const blocks = getByTestId('amountBlocks');
        expect(blocks.innerHTML).toBe(
          '<span class="">12</span>' +
          '<span class="space">345</span>');
      });

      it('21 ' + coin + ' with removeBtcTrailingZeroes disabled gets spaced', () => {
        const { getByTestId } = render(<Amount amount="21" unit={coin}/>);
        const blocks = getByTestId('amountBlocks');
        expect(blocks.innerHTML).toBe('<span class="">21</span>');
      });
    });
  });

  describe('BTC/LTC coins amounts', () => {
    let coins: CoinUnit[] = ['BTC', 'TBTC', 'LTC', 'TLTC'];
    coins.forEach(coin => {
      it('10.00000000 ' + coin + ' with removeBtcTrailingZeroes enabled becomes 10', () => {
        const { container } = render(<Amount amount="10.00000000" unit={coin} removeBtcTrailingZeroes/>);
        expect(container).toHaveTextContent('10');
      });
      it('12345.12300000 ' + coin + ' with removeBtcTrailingZeroes enabled becomes 12345.123', () => {
        const { container } = render(<Amount amount="12345.12300000" unit={coin} removeBtcTrailingZeroes/>);
        expect(container).toHaveTextContent('12345.123');
      });
      it('42 ' + coin + ' with removeBtcTrailingZeroes enabled stays 42', () => {
        const { container } = render(<Amount amount="42" unit={coin} removeBtcTrailingZeroes/>);
        expect(container).toHaveTextContent('42');
      });
      it('0.12345678 ' + coin + ' with removeBtcTrailingZeroes enabled stays 0.12345678', () => {
        const { container } = render(<Amount amount="0.12345678" unit={coin} removeBtcTrailingZeroes/>);
        expect(container).toHaveTextContent('0.12345678');
      });
      it('10.00000000 ' + coin + ' with removeBtcTrailingZeroes disabled gets spaced', () => {
        const { getByTestId } = render(<Amount amount="10.00000000" unit={coin}/>);
        const blocks = getByTestId('amountBlocks');
        expect(blocks.innerHTML).toBe(
          '<span>10.00</span>' +
          '<span class="space">000</span>' +
          '<span class="space">000</span>');
      });
      it('12345.12300000 ' + coin + ' with removeBtcTrailingZeroes disabled gets spaced', () => {
        const { getByTestId } = render(<Amount amount="12345.12300000" unit={coin}/>);
        const blocks = getByTestId('amountBlocks');
        expect(blocks.innerHTML).toBe(
          '<span>12345.12</span>' +
          '<span class="space">300</span>' +
          '<span class="space">000</span>');
      });
      it('42 ' + coin + ' with removeBtcTrailingZeroes disabled stays 42', () => {
        const { container } = render(<Amount amount="42" unit={coin}/>);
        expect(container).toHaveTextContent('42');
      });
      it('0.12345678 ' + coin + ' with removeBtcTrailingZeroes disabled gets spaced', () => {
        const { getByTestId } = render(<Amount amount="0.12345678" unit={coin}/>);
        const blocks = getByTestId('amountBlocks');
        expect(blocks.innerHTML).toBe(
          '<span>0.12</span>' +
          '<span class="space">345</span>' +
          '<span class="space">678</span>');
      });
    });
  });

  describe('non BTC coins amounts', () => {
    let coins: CoinUnit[] = ['ETH', 'GOETH'];
    coins.forEach(coin => {
      it('10.00000000 ' + coin + ' with removeBtcTrailingZeroes enabled stays 10.00000000', () => {
        const { container } = render(<Amount amount="10.00000000" unit={coin} removeBtcTrailingZeroes/>);
        expect(container).toHaveTextContent('10.00000000');
      });
      it('10.12300000 ' + coin + ' with removeBtcTrailingZeroes enabled stays 10.12300000', () => {
        const { container } = render(<Amount amount="10.12300000" unit={coin} removeBtcTrailingZeroes/>);
        expect(container).toHaveTextContent('10.12300000');
      });
      it('42 ' + coin + ' with removeBtcTrailingZeroes enabled stays 42', () => {
        const { container } = render(<Amount amount="42" unit={coin} removeBtcTrailingZeroes/>);
        expect(container).toHaveTextContent('42');
      });
      it('10.00000000 ' + coin + ' with removeBtcTrailingZeroes disabled stays 10.00000000', () => {
        const { container } = render(<Amount amount="10.00000000" unit={coin}/>);
        expect(container).toHaveTextContent('10.00000000');
      });
      it('10.12300000 ' + coin + ' with removeBtcTrailingZeroes disabled stays 10.12300000', () => {
        const { container } = render(<Amount amount="10.12300000" unit={coin}/>);
        expect(container).toHaveTextContent('10.12300000');
      });
      it('42 ' + coin + ' with removeBtcTrailingZeroes disabled stays 42', () => {
        const { container } = render(<Amount amount="42" unit={coin}/>);
        expect(container).toHaveTextContent('42');
      });
    });
  });

  describe('fiat amounts', () => {
    let fiatCoins: ConversionUnit[] = ['USD', 'EUR', 'CHF'];
    fiatCoins.forEach(coin => {
      it('1\'340.25 ' + coin + ' with removeBtcTrailingZeroes enabled stays 1\'340.25', () => {
        const { container } = render(<Amount amount="1'340.25" unit={coin} removeBtcTrailingZeroes/>);
        expect(container).toHaveTextContent('1\'340.25');
      });
      it('218.00 ' + coin + ' with removeBtcTrailingZeroes enabled stays 218.00', () => {
        const { container } = render(<Amount amount="218.00" unit={coin} removeBtcTrailingZeroes/>);
        expect(container).toHaveTextContent('218.00');
      });
      it('1\'340.25 ' + coin + ' with removeBtcTrailingZeroes disabled stays 1\'340.25', () => {
        const { container } = render(<Amount amount="1'340.25" unit={coin}/>);
        expect(container).toHaveTextContent('1\'340.25');
      });
      it('218.00 ' + coin + ' with removeBtcTrailingZeroes disabled stays 218.00', () => {
        const { container } = render(<Amount amount="218.00" unit={coin}/>);
        expect(container).toHaveTextContent('218.00');
      });

    });
  });
});
