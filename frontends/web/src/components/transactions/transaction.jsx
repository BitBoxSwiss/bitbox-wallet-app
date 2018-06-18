import { Component } from 'preact';
import { translate } from 'react-i18next';
import A from '../anchor/anchor';
import Rates from '../rates/rates';
import style from './transaction.css';

@translate()
export default class Transaction extends Component {
    state = {
        collapsed: true,
    }

    onUncollapse = e => {
        this.setState(({ collapsed }) => ({ collapsed: !collapsed }));
    }

    parseTime = time => {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dt = new Date(Date.parse(time));
        return `${days[dt.getDay()]}, ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}, at ${dt.getHours()}:${(dt.getMinutes() < 10 ? '0' : '') + dt.getMinutes()}`;
    }

    render({
        t,
        explorerURL,
        type,
        id,
        amount,
        fiat = '',
        fiatHistorical = '',
        fee,
        feeRatePerKb,
        vsize,
        size,
        weight,
        numConfirmations,
        time,
        addresses,
    }, {
        collapsed,
    }) {
        const badge = t(`transaction.badge.${type}`);
        const sign = ((type === 'send') && '−') || ((type === 'receive') && '+') || null;
        // TODO: check if 'Time not yet available' is needed
        const date = time ? this.parseTime(time) : (numConfirmations <= 0 ? t('transaction.pending') : 'Time not yet available');
        return (
            <div class={[style.transactionContainer, collapsed ? style.collapsed : style.expanded].join(' ')}>
                <div class={['flex flex-column flex-start', style.transaction].join(' ')}>
                    <div class={['flex flex-row flex-between flex-items-start', style.row].join(' ')}>
                        <div class="flex flex-row flex-start flex-items-center">
                            <div class={style.labelContainer} onClick={this.onUncollapse}>
                                <div class={style.toggleContainer}>
                                    <div class={[style.toggle, style[type], collapsed ? style.collapsed : style.expanded].join(' ')}></div>
                                </div>
                                <div class={[style.transactionLabel, style[type], style.flat].join(' ')}>
                                    {badge}
                                </div>
                            </div>
                            <div>
                                <div class={style.date}>{date}</div>
                                <div class={style.address}>{addresses.join(', ')}</div>
                            </div>
                        </div>
                        <div class={[style.amount, style[type]].join(' ')}>
                            <div>{sign}{amount.amount} <span class={style.unit}>{amount.unit}</span></div>
                            <div class={style.fiat}><Rates amount={amount}>{sign}</Rates></div>
                        </div>
                    </div>
                    <div class={[style.collapsedContent, !collapsed ? style.active : '', 'flex flex-row flex-start'].join(' ')}>
                        <div class={style.spacer}></div>
                        <div>
                            <div class={['flex flex-row flex-start flex-items-start spaced', style.row].join(' ')}>
                                <div>
                                    <div class={style.transactionLabel}>{t('transaction.confirmation')}</div>
                                    <div class={style.address}>{numConfirmations}</div>
                                </div>
                                <div>
                                    <div class={style.transactionLabel}>{t('transaction.vsize')}</div>
                                    <div class={style.address}>{vsize} bytes</div>
                                </div>
                                <div>
                                    <div class={style.transactionLabel}>{t('transaction.size')}</div>
                                    <div class={style.address}>{size} bytes</div>
                                </div>
                                <div>
                                    <div class={style.transactionLabel}>{t('transaction.weight')}</div>
                                    <div class={style.address}>{weight}</div>
                                </div>
                                {
                                    fee && (
                                        <div>
                                            <div class={style.transactionLabel}>{t('transaction.fee')}</div>
                                            <div class={style.address} title={feeRatePerKb.amount + ' ' + feeRatePerKb.unit + '/Kb'}>{fee.amount} {fee.unit}</div>
                                        </div>
                                    )
                                }
                                {
                                    fiatHistorical && (
                                        <div style="align-self: flex-end; margin-left: auto; text-align: right;">
                                            <div class={style.transactionLabel} style="margin-right: 0;">
                                                {t('transaction.fiatHistorical')}
                                            </div>
                                            <div class={style.address}>{fiatHistorical}</div>
                                        </div>
                                    )
                                }
                            </div>
                            <div class={style.row}>
                                <div class={style.transactionLabel}>
                                    {t('transaction.explorer')}
                                </div>
                                <div class={style.address}>
                                    {id}
                                    <A href={ explorerURL + id } title={t('transaction.explorerTitle')}>
                                        <span class={style.external}></span>
                                    </A>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
