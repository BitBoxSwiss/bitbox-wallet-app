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

import { Component, h, RenderableProps } from 'preact';
import { BalanceInterface } from '../../../components/balance/balance';
import { load } from '../../../decorators/load';
import { translate, TranslateProps } from '../../../decorators/translate';
import { AccountInterface } from '../account';
import { AccountsSummary } from './accountssummary';

interface LoadedProps {
    [property: number]: BalanceInterface;
}

interface ProvidedProps {
    accounts: AccountInterface[];
    [property: number]: BalanceInterface;
}

type Props = ProvidedProps & TranslateProps & LoadedProps;

class FetchBalances extends Component<Props> {
    public render({}: RenderableProps<Props>): JSX.Element {
        return (
            <div>
                <div>
                    <AccountsSummary {...this.props} />
                </div>
            </div>
        );
    }
}

const subscribeBalances = ({ accounts }: ProvidedProps & TranslateProps) => {
    const endpoints: string[] = [];
    accounts.map((account: AccountInterface, index: number) => {endpoints[index] =  'account/' + account.code + '/balance'; });
    return endpoints;
};

const HOC = translate<ProvidedProps>()(load<LoadedProps, ProvidedProps & TranslateProps>(props => subscribeBalances(props))(FetchBalances));

export { HOC as FetchBalances };
