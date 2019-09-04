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
import { store } from '../rates/rates';

@translate()
export default class Transactions extends Component {
    constructor(props) {
        super(props);
        this.state = {
            fiatCode: store.state.active,
        }
    }

    render({
        t,
        explorerURL,
        transactions,
        unit,
        exported,
        handleExport,
    }, {
        fiatCode,
    }) {
        return (
            <div className={style.container}>
                <div className="flex flex-row flex-between flex-items-center">
                    <label className="labelLarge">Transaction History</label>
                    {
                        exported ? (
                            <A href={exported} className="labelLarge labelLink">{t('account.openFile')}</A>
                        ) : (
                            <A href="#" onClick={handleExport} className="labelLarge labelLink" title={t('account.exportTransactions')}>Export</A>
                        )
                    }
                </div>
                <div className={[style.columns, style.headers, style.hideOnMedium].join(' ')}>
                    <div className={style.type}>Type</div>
                    <div className={style.date}>Date</div>
                    <div className={style.address}>Address</div>
                    <div className={style.status}>Status</div>
                    <div className={style.fiat}>{fiatCode}</div>
                    <div className={style.currency}>{unit}</div>
                    <div className={style.action}>&nbsp;</div>
                </div>
                {
                    transactions.length > 0 ? transactions.map(props => (
                        <Transaction
                            key={props.id}
                            explorerURL={explorerURL}
                            fiatCode={fiatCode}
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
