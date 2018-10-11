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

 /* Imported svg source (excluding BitBox logos): http://cryptoicons.co/ */

import { h } from 'preact';
import BitBoxInvertedLogo from './assets/bitbox-logo-alt.svg';
import BitBoxLogo from './assets/bitbox-logo.svg';
import BitBoxSwissInvertedLogo from './assets/bitbox-swisscross-inverted-logo.svg';
import BitBoxSwissLogo from './assets/bitbox-swisscross-logo.svg';
import BTC from './assets/btc-color.svg';
import BTC_GREY from './assets/btc-white.svg';
import ETH from './assets/eth-color.svg';
import ETH_GREY from './assets/eth-white.svg';
import LTC from './assets/ltc-color.svg';
import LTC_GREY from './assets/ltc-white.svg';
import ShiftLogo from './assets/shift-cryptosecurity-logo.svg';
import * as style from './logo.css';

interface GenericProps {
    [property: string]: any;
}

export const BitBox = (props: GenericProps) => <img {...props} draggable={false} src={BitBoxLogo} alt="BitBox" class={style.logo} />;
export const BitBoxInverted = (props: GenericProps) => <img {...props} draggable={false} src={BitBoxInvertedLogo} alt="BitBox" className={style.logo} />;
export const BitBoxSwiss = (props: GenericProps) => <img {...props} draggable={false} src={BitBoxSwissLogo} alt="BitBox" className={style.logo} />;
export const BitBoxSwissInverted = (props: GenericProps) => <img {...props} draggable={false} src={BitBoxSwissInvertedLogo} alt="BitBox" className={style.logo} />;
export const Shift = (props: GenericProps) => <img {...props} draggable={false} src={ShiftLogo} alt="SHIFT Cryptosecurity" className={style.logo} />;

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
    'eth': [ETH, ETH_GREY],
    'teth': [ETH, ETH_GREY],
};

interface Props {
    code: string;
    className?: string;
    alt?: string;
}

function Logo({ code, ...rest }: Props) {
    return (
        <div class="stacked">
            <img draggable={false} src={logoMap[code][1]} {...rest} />
            <img draggable={false} src={logoMap[code][0]} {...rest} />
        </div>
    );
}

export default Logo;
