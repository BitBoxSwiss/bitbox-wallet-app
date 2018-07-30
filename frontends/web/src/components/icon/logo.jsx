/**
 * Copyright 2018 Shift Devices AG
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

import { h } from 'preact';
import style from './logo.css';
import BTC from './assets/bitcoin.svg';
import BTC_GREY from './assets/bitcoin_disabled.svg';
import LTC from './assets/litecoin.svg';
import LTC_GREY from './assets/litecoin_disabled.svg';
import BitBoxLogo from './assets/bitbox-logo.svg';
import BitBoxInvertedLogo from './assets/bitbox-logo-alt.svg';
import BitBoxSwissLogo from './assets/bitbox-swisscross-logo.svg';
import BitBoxSwissInvertedLogo from './assets/bitbox-swisscross-inverted-logo.svg';
import ShiftLogo from './assets/shift-cryptosecurity-logo.svg';

export const BitBox = props => <img {...props} src={BitBoxLogo} alt="BitBox" className={style.logo} />;
export const BitBoxInverted = props => <img {...props} src={BitBoxInvertedLogo} alt="BitBox" className={style.logo} />;
export const BitBoxSwiss = props => <img {...props} src={BitBoxSwissLogo} alt="BitBox" className={style.logo} />;
export const BitBoxSwissInverted = props => <img {...props} src={BitBoxSwissInvertedLogo} alt="BitBox" className={style.logo} />;
export const Shift = props => <img {...props} src={ShiftLogo} alt="SHIFT Cryptosecurity" className={style.logo} />;

const logoMap = {
    'tbtc': [BTC, BTC_GREY], // eslint-disable-line quote-props
    'btc-p2pkh': [BTC, BTC_GREY],
    'tbtc-p2pkh': [BTC, BTC_GREY],
    'btc-p2wpkh-p2sh': [BTC, BTC_GREY],
    'btc-p2wpkh': [BTC, BTC_GREY],
    'tbtc-p2wpkh-p2sh': [BTC, BTC_GREY],
    'tbtc-p2wpkh': [BTC, BTC_GREY],
    'ltc-p2wpkh-p2sh': [LTC, LTC_GREY],
    'ltc-p2wpkh': [LTC, LTC_GREY],
    'tltc-p2wpkh-p2sh': [LTC, LTC_GREY],
    'tltc-p2wpkh': [LTC, LTC_GREY],
};

export default function Logo({ code, ...props }) {
    return (
        <div class="stacked">
            <img draggable="false" src={logoMap[code][1]} {...props} />
            <img draggable="false" src={logoMap[code][0]} {...props} />
        </div>
    );
}
