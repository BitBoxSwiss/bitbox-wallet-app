import { h } from 'preact';
import style from './logo.css';
import BTC from '../../assets/icons/bitcoin.svg';
import BTC_GREY from '../../assets/icons/bitcoin_disabled.svg';
import LTC from '../../assets/icons/litecoin.svg';
import LTC_GREY from '../../assets/icons/litecoin_disabled.svg';
import BitBoxLogo from '../../assets/icons/bitbox-logo.svg';
import ShiftLogo from '../../assets/icons/shift-cryptosecurity-logo.svg';

export const BitBox = props => <img {...props} src={BitBoxLogo} alt="BitBox" className={style.logo} />;
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
