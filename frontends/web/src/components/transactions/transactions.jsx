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

import { h } from 'preact';
import i18n from '../../i18n/i18n';
import Transaction from './transaction';

export default function Transactions({
    explorerURL,
    transactions,
    className,
}) {
    return (
        <div className={className} style="flex-grow: 1;">
            {
                transactions.length > 0 ? transactions.map(props => (
                    <Transaction
                        key={props.id}
                        explorerURL={explorerURL}
                        {...props} />
                )) : (
                    <div class="flex flex-row flex-center">
                        <p class="text-bold text-gray">
                            {i18n.t('transactions.placeholder')}
                        </p>
                    </div>
                )
            }
        </div>
    );
}
