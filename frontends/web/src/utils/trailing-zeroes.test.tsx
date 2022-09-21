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

import { bitcoinRemoveTrailingZeroes } from '../../src/utils/trailing-zeroes';

describe('removeTrailingZeroes', () => {
  let coins;

  describe('coins that need to remove trailing zeroes', () => {
    coins = ['BTC', 'TBTC', 'LTC', 'TLTC'];
    coins.forEach(coin => {
      it('10.00000000 ' + coin + ' becomes 10', () => {
        expect(bitcoinRemoveTrailingZeroes('10.00000000', coin)).toBe('10');
      });
      it('10.12300000 ' + coin + ' becomes 10.123', () => {
        expect(bitcoinRemoveTrailingZeroes('10.12300000', coin)).toBe('10.123');
      });
      it('42 ' + coin + ' stays 42', () => {
        expect(bitcoinRemoveTrailingZeroes('42', coin)).toBe('42');
      });
    });
  });

  describe('coins that don\'t need to remove trailing zeroes', () => {
    coins = ['ETH', 'TETH', 'RETH', 'GOETH'];
    coins.forEach(coin => {
      it('10.00000000 ' + coin + ' stays 10.00000000', () => {
        expect(bitcoinRemoveTrailingZeroes('10.00000000', coin)).toBe('10.00000000');
      });
      it('10.12300000 ' + coin + ' stays 10.12300000', () => {
        expect(bitcoinRemoveTrailingZeroes('10.12300000', coin)).toBe('10.12300000');
      });
      it('42 ' + coin + ' stays 42', () => {
        expect(bitcoinRemoveTrailingZeroes('42', coin)).toBe('42');
      });
    });
  });

});

