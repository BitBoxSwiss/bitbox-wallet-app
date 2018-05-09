import { h } from 'preact';
import { apiURL } from '../../../utils/request';
import style from './qrcode.css';

export default function QRCode({ data }) {
    return (
        <img
            width={256}
            className={style.qrcode}
            src={apiURL('qr?data=' + encodeURIComponent(data))}
        />
    );
}
