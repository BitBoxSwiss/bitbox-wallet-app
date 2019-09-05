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
import * as parentStyle from './transactions.css';

@translate()
export default class Transaction extends Component {
    state = {
        collapsed: true,
    }

    onUncollapse = () => {
        this.setState(({ collapsed }) => ({ collapsed: !collapsed }));
    }

    parseTimeShort = time => {
        const options = {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
        };
        return new Date(Date.parse(time)).toLocaleString(this.context.i18n.language, options);
    }

    render({
        t,
        index,
        explorerURL,
        type,
        id,
        amount,
        fee,
        feeRatePerKb,
        gas,
        vsize,
        size,
        weight,
        numConfirmations,
        time,
        addresses,
        status,
    }, {
        collapsed,
    }) {
        const badge = t(`transaction.badge.${type}`);
        const sign = ((type === 'send') && '−') || ((type === 'receive') && '+') || null;
        const sDate = time ? this.parseTimeShort(time) : '---';
        const statusStyle = {
            'complete': style.statusIndicatorComplete,
            'pending': style.statusIndicatorPending,
            'failed': style.statusIndicatorFailed,
        }[status];
        const statusText = {
            'complete': "Complete",
            'pending': "Pending",
            'failed': "Failed",
        }[status];
        return (
            <div className={[style.container, collapsed ? style.collapsed : '', index === 0 ? style.first : ''].join(' ')}>
                <div className={[parentStyle.columns, style.row].join(' ')}>
                    <div className={parentStyle.columnGroup}>
                        <div className={parentStyle.type}>
                            {
                                badge === 'In' ? (
                                    <svg className={[style.type, style.typeIn].join(' ')} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <polyline points="19 12 12 19 5 12"></polyline>
                                    </svg>
                                ) : badge === 'Out' ? (
                                    <svg className={[style.type, style.typeOut].join(' ')} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="12" y1="19" x2="12" y2="5"></line>
                                        <polyline points="5 12 12 5 19 12"></polyline>
                                    </svg>
                                ) : (
                                    <svg className={[style.type, style.typeSelf].join(' ')} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                        <polyline points="12 5 19 12 12 19"></polyline>
                                    </svg>
                                )
                            }
                        </div>
                        <div className={parentStyle.date}>
                            <span className={style.columnLabel}>Date:</span>
                            <span className={style.date}>{sDate}</span>
                        </div>
                        <div className={[parentStyle.address].join(' ')}>
                            <span className={style.columnLabel}>Address:</span>
                            <span className={style.address}>{addresses.join(', ')}</span>
                        </div>
                        <div className={[parentStyle.action, parentStyle.showOnMedium].join(' ')}>
                            <a href="#" className={style.action} onClick={this.onUncollapse}>
                                {
                                    collapsed ? (
                                        <svg className={style.expandIcon} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="11" cy="11" r="8"></circle>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            <line x1="11" y1="8" x2="11" y2="14"></line>
                                            <line x1="8" y1="11" x2="14" y2="11"></line>
                                        </svg>
                                    ) : (
                                        <svg className={style.expandIcon} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="11" cy="11" r="8"></circle>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            <line x1="8" y1="11" x2="14" y2="11"></line>
                                        </svg>
                                    )
                                }
                            </a>
                        </div>
                    </div>
                    <div className={[parentStyle.columnGroup].join(' ')}>
                        <div className={parentStyle.status}>
                            <span className={style.columnLabel}>Status:</span>
                            <span className={[style.statusIndicator, statusStyle].join(' ')}></span>
                            <span className={style.status}>{statusText}</span>
                        </div>
                        <div className={parentStyle.fiat}>
                            <span className={[style.fiat, type === 'send' && style.send].join(' ')}>
                                <FiatConversion amount={amount} noAction>{type === 'send' && sign} </FiatConversion>
                            </span>
                        </div>
                        <div className={parentStyle.currency}>
                            <span className={[style.currency, type === 'send' && style.send].join(' ')}>{type === 'send' && sign} {amount.amount} {amount.unit}</span>
                        </div>
                        <div className={[parentStyle.action, parentStyle.hideOnMedium].join(' ')}>
                            <a href="#" className={style.action} onClick={this.onUncollapse}>
                                {
                                    collapsed ? (
                                        <svg className={style.expandIcon} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="11" cy="11" r="8"></circle>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            <line x1="11" y1="8" x2="11" y2="14"></line>
                                            <line x1="8" y1="11" x2="14" y2="11"></line>
                                        </svg>
                                    ) : (
                                        <svg className={style.expandIcon} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="11" cy="11" r="8"></circle>
                                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            <line x1="8" y1="11" x2="14" y2="11"></line>
                                        </svg>
                                    )
                                }
                            </a>
                        </div>
                    </div>
                </div>
                {
                    !collapsed && (
                        <div className={style.expandedContent}>
                            <div className={style.expandedItems}>
                                <div className={style.confirmations}>
                                    <span className={style.inlineLabel}>{t('transaction.confirmation')}:</span><span className={style.inlineValue}>{numConfirmations}</span>
                                </div>
                                {
                                    gas ? (
                                        <div className={style.gas}>
                                            <span className={style.inlineLabel}>{t('transaction.gas')}:</span><span className={style.inlineValue}>{gas}</span>
                                        </div>
                                    ) : null
                                }
                                {
                                    weight ? (
                                        <div className={style.weight}>
                                            <span className={style.inlineLabel}>{t('transaction.weight')}:</span><span className={style.inlineValue}>{weight}</span>
                                        </div>
                                    ) : null
                                }
                                {
                                    vsize ? (
                                        <div className={style.virtualSize}>
                                            <span className={style.inlineLabel}>{t('transaction.vsize')}:</span><span className={style.inlineValue}>{vsize}</span>
                                        </div>
                                    ) : null
                                }
                                {
                                    size ? (
                                        <div className={style.size}>
                                            <span className={style.inlineLabel}>{t('transaction.size')}:</span><span className={style.inlineValue}>{size}</span>
                                        </div>
                                    ) : null
                                }
                                <div className={style.fee}>
                                    <span className={style.inlineLabel}>{t('transaction.fee')}:</span>
                                    {
                                        fee && fee.amount ? (
                                            <span title={feeRatePerKb.amount ? feeRatePerKb.amount + ' ' + feeRatePerKb.unit + '/Kb' : ''} className={style.inlineValue}>{fee.amount} {fee.unit}</span>
                                        ) : (
                                            <span className={style.inlineValue}>---</span>
                                        )
                                    }
                                </div>
                            </div>
                            <div className={style.expandedTransactionContainer}>
                                <div className={style.transactionId}>
                                    <span className={style.inlineLabel}>{t('transaction.explorer')}:</span>
                                    <span className={style.inlineValue}><A className={style.externalLink} href={ explorerURL + id } title={t('transaction.explorerTitle')}>{id}</A></span>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>
        );
    }
}
