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
import Transaction from './transaction';
import A from '../../components/anchor/anchor';
import * as style from './transactions.css';

@translate()
export default class Transactions extends Component {
    render({
        t,
        explorerURL,
        transactions,
        exported,
        handleExport,
    }) {
        return (
            <div className={style.container}>
                <div className="flex flex-row flex-between flex-items-center">
                    <label className="labelXLarge">{t('accountSummary.transactionHistory')}</label>
                    {
                        exported ? (
                            <A href={exported} className="labelXLarge labelLink">{t('account.openFile')}</A>
                        ) : (
                            <A href="#" onClick={handleExport} className="labelXLarge labelLink" title={t('account.exportTransactions')}>{t('account.export')}</A>
                        )
                    }
                </div>
                <div className={[style.columns, style.headers, style.showOnMedium].join(' ')}>
                    <div className={style.type}>{t('transaction.details.type')}</div>
                    <div className={style.date}>{t('transaction.details.date')}</div>
                    <div className={style.address}>{t('transaction.details.address')}</div>
                    <div className={style.status}>{t('transaction.details.status')}</div>
                    <div className={style.fiat}>{t('transaction.details.fiatAmount')}</div>
                    <div className={style.currency}>{t('transaction.details.amount')}</div>
                    <div className={style.action}>&nbsp;</div>
                </div>
                {
                    transactions.length > 0 ? transactions.map((props, index) => (
                        <Transaction
                            key={props.internalID}
                            explorerURL={explorerURL}
                            index={index}
                            {...props} />
                    )) : (
                        <div class={['flex flex-row flex-center', style.empty].join(' ')}>
                            <p>{t('transactions.placeholder')}</p>
                        </div>
                    )
                }
            </div>
        );
    }
}
