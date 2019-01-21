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
import { Checkbox } from '../../../components/forms';
import { Coin, FiatConversion } from '../../../components/rates/rates';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet } from '../../../utils/request';
import * as style from './utxos.css';

interface UTXOsProps {
    accountCode: string;
    active: boolean;
    onChange: (SelectedUTXOProps) => void;
}

interface UTXOProps {
    outPoint: string;
    address: string;
    amount: UTXOAmountProps;
}

interface UTXOAmountProps {
    amount: string;
    unit: Coin;
}

export interface SelectedUTXOProps {
    [key: string]: boolean;
}

type Props = UTXOsProps & TranslateProps;

interface State {
    utxos: UTXOProps[];
    selectedUTXOs: SelectedUTXOProps;
}

class UTXOs extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            utxos: [],
            selectedUTXOs: {},
        };
    }

    public componentDidMount() {
        apiGet(`account/${this.props.accountCode}/utxos`).then(utxos => {
            this.setState({ utxos });
        });
    }

    // @ts-ignore => called in parent component
    private clear = () => {
        this.setState({ selectedUTXOs: {} }, () => {
            this.props.onChange(this.state.selectedUTXOs);
        });
    }

    private handleUTXOChange = event => {
        const outPoint = event.target.dataset.outpoint;
        const selectedUTXOs = Object.assign({}, this.state.selectedUTXOs);
        if (event.target.checked) {
            selectedUTXOs[outPoint] = true;
        } else {
            delete selectedUTXOs[outPoint];
        }
        this.setState({ selectedUTXOs }, () => {
            this.props.onChange(selectedUTXOs);
        });
    }

    public render(
        { t, active }: RenderableProps<Props>,
        { utxos, selectedUTXOs }: State,
    ) {
        return (
            <div class="row">
                {
                    active ? (
                        <div class={[style.container, active ? style.expanded : style.collapsed].join(' ')}>
                            <div class="subHeaderContainer">
                                <div class={['subHeader', style.subHeader].join(' ')}>
                                    <h3>{t('send.coincontrol.title')}</h3>
                                </div>
                            </div>
                            <div class={style.tableContainer}>
                                <table className={style.table}>
                                    {
                                        utxos.map(utxo => (
                                            <tr key={'utxo-' + utxo.outPoint}>
                                                <td>
                                                    <Checkbox
                                                        checked={!!selectedUTXOs[utxo.outPoint]}
                                                        id={'utxo-' + utxo.outPoint}
                                                        data-outpoint={utxo.outPoint}
                                                        onChange={this.handleUTXOChange}
                                                    />
                                                </td>
                                                <td>
                                                    <span><label>{t('send.coincontrol.outpoint')}:</label> {utxo.outPoint}</span>
                                                    <span><label>{t('send.coincontrol.address')}:</label> {utxo.address}</span>
                                                </td>
                                                <td class={style.right}>
                                                    <table class={style.amountTable} align="right">
                                                        <tr>
                                                            <td>{utxo.amount.amount}</td>
                                                            <td>{utxo.amount.unit}</td>
                                                        </tr>
                                                        <FiatConversion amount={utxo.amount} tableRow unstyled />
                                                    </table>
                                                </td>
                                            </tr>
                                        ))
                                    }
                                </table>
                            </div>
                        </div>
                    ) : null
                }
            </div>
        );
    }
}

const TranslatedUTXOs = translate<UTXOsProps>(null, { withRef: true })(UTXOs);
export { TranslatedUTXOs as UTXOs };
