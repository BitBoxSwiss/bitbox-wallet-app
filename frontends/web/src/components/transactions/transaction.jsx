/**
 * Copyright 2018 Shift Devices AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { FiatConversion } from '../rates/rates';
import A from '../anchor/anchor';
import * as style from './transaction.css';

@translate()
export default class Transaction extends Component {
    state = {
        collapsed: true,
    }

    onUncollapse = e => {
        this.setState(({ collapsed }) => ({ collapsed: !collapsed }));
    }

    parseTime = time => {
        const months = this.props.t('months');
        const days = this.props.t('days');
        const dt = new Date(Date.parse(time));
        return `${days[dt.getDay()]}, ${dt.getDate()}${this.props.t('dayPeriod')} ${months[dt.getMonth()]} ${dt.getFullYear()}, ${this.props.t('atTime')} ${dt.getHours()}:${(dt.getMinutes() < 10 ? '0' : '') + dt.getMinutes()}`;
    }

    render({
        t,
        explorerURL,
        type,
        id,
        amount,
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
                            <div class={style.fiat}><FiatConversion amount={amount}>{sign}</FiatConversion></div>
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
                                    fee && fee.amount && (
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
