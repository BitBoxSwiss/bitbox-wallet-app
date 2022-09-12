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

import React, { Component } from 'react';
import * as accountApi from '../../../api/account';
import A from '../../../components/anchor/anchor';
import { Dialog } from '../../../components/dialog/dialog';
import { Button, Checkbox } from '../../../components/forms';
import { ExpandOpen } from '../../../components/icon/icon';
import { FiatConversion } from '../../../components/rates/rates';
import { translate, TranslateProps } from '../../../decorators/translate';
import { getScriptName } from '../utils';
import { unsubscribe, UnsubscribeList } from '../../../utils/subscriptions';
import { syncdone } from '../../../api/subscribe-legacy';
import style from './utxos.module.css';

interface UTXOsProps {
    accountCode: string;
    active: boolean;
    explorerURL: string;
    onChange: (selectedUTXO: SelectedUTXO) => void;
    onClose: () => void;
    // eslint-disable-next-line react/no-unused-prop-types
    ref?: React.RefObject<any> // WithTranslation doesn't add ref prop correctly
}

export interface SelectedUTXO {
    [key: string]: boolean;
}

export type Props = UTXOsProps & TranslateProps;

interface State {
    utxos: accountApi.UTXO[];
    selectedUTXOs: SelectedUTXO;
}

export class UTXOsClass extends Component<Props, State> {
  public readonly state: State = {
    utxos: [],
    selectedUTXOs: {},
  };

  private subscribtions: UnsubscribeList = [];

  public componentDidMount() {
    this.getUTXOs();
    this.subscribe();
  }

  public componentWillUnmount() {
    unsubscribe(this.subscribtions);
  }

  private subscribe() {
    this.subscribtions.push(
      syncdone(this.props.accountCode, () => this.getUTXOs()),
    );
  }

  private getUTXOs() {
    accountApi.getUTXOs(this.props.accountCode).then(utxos => {
      this.setState({ utxos });
    });
  }

  public clear = () => {
    this.setState({ selectedUTXOs: {} }, () => {
      this.props.onChange(this.state.selectedUTXOs);
    });
  };

  private handleUTXOChange = (event: React.SyntheticEvent) => {
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
  };

  private renderUTXOs = (scriptType: accountApi.ScriptType) => {
    const { t, explorerURL } = this.props;
    const { utxos, selectedUTXOs } = this.state;
    const filteredUTXOs = utxos.filter(utxo => utxo.scriptType === scriptType);
    if (filteredUTXOs.length === 0) {
      return null;
    }
    return (
      <div>
        <h2 className="subTitle">{ getScriptName(scriptType) }</h2>
        <ul className={style.utxosList}>
          { filteredUTXOs.map(utxo => (
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
                      <FiatConversion amount={utxo.amount} unstyled noAction/>
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
                      </span>:{utxo.txOutput}
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
          )) }
        </ul>
      </div>
    );
  };

  public render() {
    const { t, active, onClose } = this.props;
    if (!active) {
      return null;
    }
    return (
      <Dialog title={t('send.coincontrol.title')} large onClose={onClose}>
        <div>
          { accountApi.allScriptTypes.map(this.renderUTXOs) }
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

const TranslatedUTXOs = translate(undefined, { withRef: true })(UTXOsClass);
export { TranslatedUTXOs as UTXOs };
