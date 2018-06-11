import { h } from 'preact';
import { apiGet } from '../../../utils/request';
import style from './qrcode.css';

export default function QRCode({ data }) {
    apiGet('qr?data=' + encodeURIComponent(data)).then(src => this.img.setAttribute('src', src));
    return (
        <img
            ref={ref => this.img = ref}
            width={256}
            className={style.qrcode}
        />
    );
}
