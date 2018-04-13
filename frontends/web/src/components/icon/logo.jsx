import { Component } from 'preact';

import BTC from '../../assets/icons/bitcoin.svg';
import LTC from '../../assets/icons/litecoin.svg';

const logoMap = {
    btc: BTC,
    tbtc: BTC,
    'btc-p2wpkh-p2sh': BTC,
    'tbtc-p2wpkh-p2sh': BTC,
    ltc: LTC,
    'ltc-p2wpkh-p2sh': LTC,
    'tltc-p2wpkh-p2sh': LTC
};

export default function Logo({ code, ...props }) {
    return (
        <img src={logoMap[code]} {...props} />
    );
}
