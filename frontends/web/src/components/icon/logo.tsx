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
import AppLogoInvertedImg from './assets/app-logo-inverted.svg';
import AppLogoImg from './assets/app-logo.svg';
import BitBoxLogo from './assets/bitbox-logo.svg';
import BitBoxSwissInvertedLogo from './assets/bitbox-swisscross-inverted-logo.svg';
import BitBoxSwissLogo from './assets/bitbox-swisscross-logo.svg';
import BitBox02Logo from './assets/bitbox02-logo.svg';
import BaseLogo from './assets/bitboxbase-logo.svg';
import BTC from './assets/btc-color.svg';
import BTC_GREY from './assets/btc-white.svg';
import ETH from './assets/eth-color.svg';
import ETH_GREY from './assets/eth-white.svg';
import LTC from './assets/ltc-color.svg';
import LTC_GREY from './assets/ltc-white.svg';
import SwissOpenSource from './assets/swiss_made_open_source.svg';

import BAT from './assets/bat-color.svg';
import BAT_GREY from './assets/bat-white.svg';
import DAI from './assets/dai-color.svg';
import DAI_GREY from './assets/dai-white.svg';
import LINK from './assets/link-color.svg';
import LINK_GREY from './assets/link-white.svg';
import MKR from './assets/mkr-color.svg';
import MKR_GREY from './assets/mkr-white.svg';
import SAI from './assets/sai-color.svg';
import SAI_GREY from './assets/sai-white.svg';
import USDC from './assets/usdc-color.svg';
import USDC_GREY from './assets/usdc-white.svg';
import USDT from './assets/usdt-color.svg';
import USDT_GREY from './assets/usdt-white.svg';
import ZRX from './assets/zrx-color.svg';
import ZRX_GREY from './assets/zrx-white.svg';
import WBTC from './assets/wbtc-color.svg';
import WBTC_GREY from './assets/wbtc-white.svg';
import PAXG from './assets/paxg-color.svg';
import PAXG_GREY from './assets/paxg-white.svg';

import ShiftLogo from './assets/shift-cryptosecurity-logo.svg';
import * as style from './logo.css';

interface GenericProps {
    [property: string]: any;
}

export const BitBox = (props: GenericProps) => <img {...props} draggable={false} src={BitBoxLogo} alt="BitBox" class={style.logo} />;
export const BitBox02 = (props: GenericProps) => <img {...props} draggable={false} src={BitBox02Logo} alt="BitBox02" class={style.logo} />;
export const AppLogo = (props: GenericProps) => <img {...props} draggable={false} src={AppLogoImg} alt="BitBox" className={style.logo} />;
export const AppLogoInverted = (props: GenericProps) => <img {...props} draggable={false} src={AppLogoInvertedImg} alt="BitBox" className={style.logo} />;
export const BitBoxSwiss = (props: GenericProps) => <img {...props} draggable={false} src={BitBoxSwissLogo} alt="BitBox" className={style.logo} />;
export const BitBoxSwissInverted = (props: GenericProps) => <img {...props} draggable={false} src={BitBoxSwissInvertedLogo} alt="BitBox" className={style.logo} />;
export const Shift = (props: GenericProps) => <img {...props} draggable={false} src={ShiftLogo} alt="Shift Crypto" className={style.logo} />;
export const SwissMadeOpenSource = (props: GenericProps) => <img {...props} draggable={false} src={SwissOpenSource} alt="Swiss Made Open Source" className={[style.swissOpenSource, props.large ? style.large : ''].join(' ')} />;
export const BitBoxBaseLogo = (props: GenericProps) => <img {...props} draggable={false} src={BaseLogo} alt="BitBoxBase" className={style.logo} />;

const logoMap = {
    'btc': [BTC, BTC_GREY],
    'tbtc': [BTC, BTC_GREY],
    'rbtc': [BTC, BTC_GREY],
    'ltc': [LTC, LTC_GREY],
    'tltc': [LTC, LTC_GREY],
    'eth': [ETH, ETH_GREY],
    'teth': [ETH, ETH_GREY],
    'reth': [ETH, ETH_GREY],
    'erc20Test': [ETH, ETH_GREY],

    'eth-erc20-usdt': [USDT, USDT_GREY],
    'eth-erc20-usdc': [USDC, USDC_GREY],
    'eth-erc20-sai0x89d2': [SAI, SAI_GREY],
    'eth-erc20-dai0x6b17': [DAI, DAI_GREY],
    'eth-erc20-link': [LINK, LINK_GREY],
    'eth-erc20-bat': [BAT, BAT_GREY],
    'eth-erc20-mkr': [MKR, MKR_GREY],
    'eth-erc20-zrx': [ZRX, ZRX_GREY],
    'eth-erc20-wbtc': [WBTC, WBTC_GREY],
    'eth-erc20-paxg': [PAXG, PAXG_GREY],
};

interface Props {
    coinCode: string;
    className?: string;
    alt?: string;
    active?: boolean;
}

function Logo({ coinCode, active, ...rest }: Props) {
    if (!logoMap[coinCode]) {
        console.error('logo undefined for ', coinCode);
        return null;
    }
    return (
        <div>
            { active ? <img draggable={false} src={logoMap[coinCode][0]} {...rest}/>
              : <div class="stacked">
                  <img draggable={false} src={logoMap[coinCode][1]} {...rest} />
                  <img draggable={false} src={logoMap[coinCode][0]} {...rest} />
              </div>}
        </div>
    );
}

export default Logo;
