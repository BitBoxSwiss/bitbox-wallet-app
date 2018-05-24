import { h } from 'preact';
import style from './logo.css';
import BTC from '../../assets/icons/bitcoin.svg';
import LTC from '../../assets/icons/litecoin.svg';
import BitBoxLogo from '../../assets/icons/bitbox-logo.svg';
import ShiftLogo from '../../assets/icons/shift-cryptosecurity-logo.svg';

export const BitBox = props => <img {...props} src={BitBoxLogo} alt="BitBox" className={style.logo} />;
export const Shift = props => <img {...props} src={ShiftLogo} alt="SHIFT Cryptosecurity" className={style.logo} />;

const logoMap = {
    btc: BTC,
    tbtc: BTC,
    'btc-p2wpkh-p2sh': BTC,
    'btc-p2wpkh': BTC,
    'tbtc-p2wpkh-p2sh': BTC,
    'tbtc-p2wpkh': BTC,
    ltc: LTC,
    'ltc-p2wpkh-p2sh': LTC,
    'ltc-p2wpkh': LTC,
    'tltc-p2wpkh-p2sh': LTC,
    'tltc-p2wpkh': LTC,
};

export default function Logo({ code, ...props }) {
    return (
        <img src={logoMap[code]} {...props} />
    );
}
