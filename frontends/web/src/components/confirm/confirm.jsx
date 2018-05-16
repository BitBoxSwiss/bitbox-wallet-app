import { h } from 'preact';
import i18n from '../../i18n/i18n';
// import style from './message.css';
import approve from './assets/approve.png';
import reject from './assets/reject.png';

export default function Confirm({
    active = false,
    children
}) {
    if (!active) {
        return children[0];
    }
    return (
        <div>
            <h1>{i18n.t('confirm.title')}</h1>
            <div className="flex flex-1 flex-row flex-between">
                <div>
                    <img src={reject} alt="Reject" />
                    <h3>{i18n.t('confirm.reject')}</h3>
                </div>
                <div>
                    <img src={approve} alt="Approve" />
                    <h3>{i18n.t('confirm.approve')}</h3>
                </div>
            </div>
        </div>
    );
}
