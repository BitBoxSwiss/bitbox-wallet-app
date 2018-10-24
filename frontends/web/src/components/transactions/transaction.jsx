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
import ArrowUp from '../../assets/icons/arrow-up.svg';
import ArrowDown from '../../assets/icons/arrow-down.svg';
import ArrowRight from '../../assets/icons/arrow-right.svg';
import ExternalLink from '../../assets/icons/external-link.svg';
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
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        };
        return new Date(Date.parse(time)).toLocaleString(this.context.i18n.language, options);
    }

    parseTimeShort = time => {
        const options = {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        };
        return new Date(Date.parse(time)).toLocaleString(this.context.i18n.language, options);
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
        const arrow = badge === 'In' ? ArrowDown : badge === 'Out' ? ArrowUp : ArrowRight;
        const sign = ((type === 'send') && '−') || ((type === 'receive') && '+') || null;
        const date = time ? this.parseTime(time) : (numConfirmations <= 0 ? t('transaction.pending') : 'Time not yet available');
        const sDate = time ? this.parseTimeShort(time) : (numConfirmations <= 0 ? t('transaction.pending') : 'Time not yet available');
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
                                    <img src={arrow} />
                                    {badge}
                                </div>
                            </div>
                            <div>
                                <div class={style.date}>
                                    <span>{date}</span>
                                    <span>{sDate}</span>
                                </div>
                                <div class={style.address}>{addresses.join(', ')}</div>
                            </div>
                        </div>
                        <div class={[style.amount, style[type]].join(' ')}>
                            <div><span class={style.amountValue}>{sign}{amount.amount}</span> <span class={style.unit}>{amount.unit}</span></div>
                            <div class={style.fiat}><FiatConversion amount={amount}>{sign}</FiatConversion></div>
                        </div>
                    </div>
                    <div class={[style.collapsedContent, !collapsed ? style.active : '', 'flex flex-row flex-start'].join(' ')}>
                        <div class={style.spacer}></div>
                        <div class="flex-1">
                            <div class={['flex flex-row flex-start flex-items-start flex-wrap', style.row, style.items].join(' ')}>
                                <div>
                                    <div class={style.transactionLabel}>{t('transaction.confirmation')}</div>
                                    <div class={style.address}>{numConfirmations}</div>
                                </div>
                                {
                                    vsize && vsize !== 0 ? (
                                        <div>
                                            <div class={style.transactionLabel}>{t('transaction.vsize')}</div>
                                            <div class={style.address}>{vsize} bytes</div>
                                        </div>
                                    ) : ''
                                }
                                {
                                    size && size !== 0 ? (
                                        <div>
                                            <div class={style.transactionLabel}>{t('transaction.size')}</div>
                                            <div class={style.address}>{size} bytes</div>
                                        </div>
                                    ) : ''
                                }
                                {
                                    weight && weight !== 0 ? (
                                        <div>
                                            <div class={style.transactionLabel}>{t('transaction.weight')}</div>
                                            <div class={style.address}>{weight}</div>
                                        </div>
                                    ) : ''
                                }
                                {
                                    fee && fee.amount && (
                                        <div>
                                            <div class={style.transactionLabel}>{t('transaction.fee')}</div>
                                            <div class={style.address} title={feeRatePerKb.amount ? feeRatePerKb.amount + ' ' + feeRatePerKb.unit + '/Kb' : ''}>{fee.amount} {fee.unit}</div>
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
                                    <A href={ explorerURL + id } title={t('transaction.explorerTitle')}>
                                        <img class={style.externalLabel} src={ExternalLink} />
                                    </A>
                                </div>
                                <div class={style.address}>
                                    {id}
                                    <A href={ explorerURL + id } title={t('transaction.explorerTitle')}>
                                        <img class={style.external} src={ExternalLink} />
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
