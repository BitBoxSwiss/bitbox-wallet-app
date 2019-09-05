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
import { Dialog } from '../../../components/dialog/dialog';
import { Checkbox } from '../../../components/forms';
import { Coin, FiatConversion } from '../../../components/rates/rates';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet } from '../../../utils/request';
import * as style from './utxos.css';

interface UTXOsProps {
    accountCode: string;
    active: boolean;
    onChange: (SelectedUTXO) => void;
    onClose: () => void;
}

interface UTXO {
    outPoint: string;
    address: string;
    amount: UTXOAmount;
}

interface UTXOAmount {
    amount: string;
    unit: Coin;
}

export interface SelectedUTXO {
    [key: string]: boolean;
}

export type Props = UTXOsProps & TranslateProps;

interface State {
    utxos: UTXO[];
    selectedUTXOs: SelectedUTXO;
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

    public clear = () => {
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
        { t, active, onClose }: RenderableProps<Props>,
        { utxos, selectedUTXOs }: State,
    ) {
        if (!active) {
            return null;
        }
        return (
            <Dialog title={t('send.coincontrol.title')} large onClose={onClose}>
                <div class={[active ? style.expanded : style.collapsed].join(' ')}>
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
                                                    <td><span>{utxo.amount.amount}</span></td>
                                                    <td><span>{utxo.amount.unit}</span></td>
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
            </Dialog>
        );
    }
}

const TranslatedUTXOs = translate<UTXOsProps>(undefined, { withRef: true })(UTXOs);
export { TranslatedUTXOs as UTXOs };
