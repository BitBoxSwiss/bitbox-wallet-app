/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  allScriptTypes,
  getUTXOs,
  ScriptType,
  TUTXO,
} from '../../../api/account';
import { syncdone } from '../../../api/subscribe-legacy';
import A from '../../../components/anchor/anchor';
import { Dialog } from '../../../components/dialog/dialog';
import { Button, Checkbox } from '../../../components/forms';
import { ExpandOpen } from '../../../components/icon';
import { FiatConversion } from '../../../components/rates/rates';
import { getScriptName } from '../utils';
import style from './utxos.module.css';

export type TSelectedUTXOs = {
  [key: string]: boolean;
};

type Props = {
  accountCode: string;
  active: boolean;
  explorerURL: string;
  onChange: (selectedUTXO: TSelectedUTXOs) => void;
  onClose: () => void;
};

export const UTXOs = ({
  accountCode,
  active,
  explorerURL,
  onChange,
  onClose,
}: Props) => {
  const { t } = useTranslation();
  const [utxos, setUtxos] = useState<TUTXO[]>([]);
  const [selectedUTXOs, setSelectedUTXOs] = useState<TSelectedUTXOs>({});

  useEffect(() => {
    getUTXOs(accountCode).then(setUtxos);
    return () => setUtxos([]);
  }, [accountCode]);

  useEffect(() => {
    const unsubscribe = syncdone(accountCode, () => {
      getUTXOs(accountCode).then(setUtxos);
    });
    return () => unsubscribe();
  }, [accountCode]);

  const handleUTXOChange = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLInputElement;
    const outPoint = target.dataset.outpoint as string;
    const proposedUTXOs = Object.assign({}, selectedUTXOs);
    if (target.checked) {
      proposedUTXOs[outPoint] = true;
    } else {
      delete proposedUTXOs[outPoint];
    }
    setSelectedUTXOs(proposedUTXOs);
    onChange(proposedUTXOs);
  };

  const renderUTXOs = (scriptType: ScriptType) => {
    const filteredUTXOs = utxos.filter(utxo => utxo.scriptType === scriptType);
    if (filteredUTXOs.length === 0) {
      return null;
    }
    return (
      <div key={'utxos-' + scriptType}>
        <h2 className="subTitle">{ getScriptName(scriptType) }</h2>
        <ul className={style.utxosList}>
          { filteredUTXOs.map(utxo => (
            <li key={'utxo-' + utxo.outPoint} className={style.utxo}>
              <Checkbox
                checked={!!selectedUTXOs[utxo.outPoint]}
                id={'utxo-' + utxo.outPoint}
                data-outpoint={utxo.outPoint}
                onChange={handleUTXOChange}>
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

  return (
    <Dialog
      open={active}
      title={t('send.coincontrol.title')}
      large
      onClose={onClose}>
      <div>
        { allScriptTypes.map(renderUTXOs) }
        <div className="buttons text-center m-top-none m-bottom-half">
          <Button primary onClick={onClose}>
            {t('button.continue')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
