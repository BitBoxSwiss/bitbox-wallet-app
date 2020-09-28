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
import A from '../../../components/anchor/anchor';
import { Dialog } from '../../../components/dialog/dialog';
import { Button, Checkbox } from '../../../components/forms';
import { ExpandOpen } from '../../../components/icon/icon';
import { Coin, FiatConversion } from '../../../components/rates/rates';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet } from '../../../utils/request';
import * as style from './utxos.css';

interface UTXOsProps {
    accountCode: string;
    active: boolean;
    explorerURL: string;
    onChange: (SelectedUTXO) => void;
    onClose: () => void;
}

interface UTXO {
    outPoint: string;
    address: string;
    amount: UTXOAmount;
}

interface UTXOwithTX extends UTXO {
    txId: string;
    txOutput: string;
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
    utxos: UTXOwithTX[];
    selectedUTXOs: SelectedUTXO;
}

class UTXOs extends Component<Props, State> {
    public readonly state: State = {
        utxos: [],
        selectedUTXOs: {},
    };

    private splitOutPoint(utxo: UTXO): UTXOwithTX {
        const [txId, txOutput] = utxo.outPoint.split(':');
        return Object.assign({
            txId,
            txOutput,
        }, utxo);
    }

    public componentDidMount() {
        apiGet(`account/${this.props.accountCode}/utxos`).then((utxos: UTXO[]) => {
            this.setState({
                utxos: utxos.map(this.splitOutPoint),
            });
        });
    }

    public clear = () => {
        this.setState({ selectedUTXOs: {} }, () => {
            this.props.onChange(this.state.selectedUTXOs);
        });
    }

    private handleUTXOChange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const outPoint = target.dataset.outpoint as string;
        const selectedUTXOs = Object.assign({}, this.state.selectedUTXOs);
        if (target.checked) {
            selectedUTXOs[outPoint] = true;
        } else {
            delete selectedUTXOs[outPoint];
        }
        this.setState({ selectedUTXOs }, () => {
            this.props.onChange(selectedUTXOs);
        });
    }

    public render(
        { t, active, explorerURL, onClose }: RenderableProps<Props>,
        { utxos, selectedUTXOs }: State,
    ) {
        if (!active) {
            return null;
        }
        return (
            <Dialog title={t('send.coincontrol.title')} large onClose={onClose}>
                <div>
                    <ul className={style.utxosList}>
                        { utxos.map(utxo => (
                            <li key={'utxo-' + utxo.outPoint} className={style.utxo}>
                                <Checkbox
                                    checked={!!selectedUTXOs[utxo.outPoint]}
                                    id={'utxo-' + utxo.outPoint}
                                    data-outpoint={utxo.outPoint}
                                    onChange={this.handleUTXOChange}>
                                    <div className={style.utxoContent}>
                                        <div className={style.utxoData}>
                                            <div className={style.amounts}>
                                                <span className={style.amount}>
                                                    {utxo.amount.amount}
                                                    {' '}
                                                    <span className={style.unit}>
                                                        {utxo.amount.unit}
                                                    </span>
                                                </span>
                                                <FiatConversion amount={utxo.amount} unstyled />
                                            </div>
                                            <div className={style.address}>
                                                <span className={style.label}>
                                                    {t('send.coincontrol.address')}:
                                                </span>
                                                <span className={style.shrink}>
                                                    {utxo.address}
                                                </span>
                                            </div>
                                            <div className={style.transaction}>
                                                <span className={style.label}>
                                                    {t('send.coincontrol.outpoint')}:
                                                </span>
                                                <span className={style.shrink}>
                                                    {utxo.txId}
                                                </span>
                                            :{utxo.txOutput}
                                            </div>
                                        </div>
                                        <A
                                            className={style.utxoExplorer}
                                            href={explorerURL + utxo.txId}
                                            title={t('transaction.explorerTitle')}>
                                            <ExpandOpen />
                                        </A>
                                    </div>
                                </Checkbox>
                            </li>
                        ))}
                    </ul>
                    <div className="buttons text-center m-top-none m-bottom-half">
                        <Button primary onClick={onClose}>
                            {t('button.continue')}
                        </Button>
                    </div>
                </div>
            </Dialog>
        );
    }
}

const TranslatedUTXOs = translate<UTXOsProps>(undefined, { withRef: true })(UTXOs);
export { TranslatedUTXOs as UTXOs };
