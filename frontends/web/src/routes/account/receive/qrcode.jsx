import { h } from 'preact';
import { apiURL } from '../../../utils/request';

export default function QRCode({ data }) {
    return (
        <img
            width={256}
            src={apiURL('qr?data=' + encodeURIComponent(data))}
        />
    );
}
