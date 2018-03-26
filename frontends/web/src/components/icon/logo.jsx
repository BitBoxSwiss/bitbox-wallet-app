import { Component } from 'preact';

import BTC from '../../assets/icons/bitcoin.svg';
import LTC from '../../assets/icons/litecoin.svg';

const logoMap = {
    btc: BTC,
    tbtc: BTC,
    'tbtc-p2wpkh-p2sh': BTC,
    ltc: LTC,
    'tltc-p2wpkh-p2sh': LTC
};

export default function Logo({code, ...props}) {
    return (
        <img src={logoMap[code]} {...props} />
    );
}
