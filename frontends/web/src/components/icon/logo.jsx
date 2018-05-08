import { h } from 'preact';
import style from './logo.css';
import BTC from '../../assets/icons/bitcoin.svg';
import LTC from '../../assets/icons/litecoin.svg';
import BitBoxLogo from '../../assets/icons/bitbox-logo.svg';
import ShiftLogo from '../../assets/icons/shift-cryptosecurity-logo.svg';

export const BitBox = <img src={BitBoxLogo} alt="BitBox" className={style.logo} />;
export const Shift = <img src={ShiftLogo} alt="SHIFT Cryptosecurity" className={style.logo} />;

const logoMap = {
    btc: BTC,
    tbtc: BTC,
    'btc-p2wpkh-p2sh': BTC,
    'tbtc-p2wpkh-p2sh': BTC,
    ltc: LTC,
    'ltc-p2wpkh-p2sh': LTC,
    'tltc-p2wpkh-p2sh': LTC,
};

export default function Logo({ code, ...props }) {
    return (
        <img src={logoMap[code]} {...props} />
    );
}
