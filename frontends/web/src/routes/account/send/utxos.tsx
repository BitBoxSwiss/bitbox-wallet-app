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

import { ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  allScriptTypes,
  getUTXOs,
  AccountCode,
  ScriptType,
  TUTXO,
} from '../../../api/account';
import { syncdone } from '../../../api/accountsync';
import { A } from '../../../components/anchor/anchor';
import { Dialog } from '../../../components/dialog/dialog';
import { Button, Checkbox } from '../../../components/forms';
import { ExternalLink } from '../../../components/icon';
import { Amount } from '../../../components/amount/amount';
import { FiatConversion } from '../../../components/rates/rates';
import { getScriptName } from '../utils';
import { Message } from '../../../components/message/message';
import { Badge } from '../../../components/badge/badge';
import style from './utxos.module.css';

export type TSelectedUTXOs = {
  [key: string]: boolean;
};

type Props = {
  accountCode: AccountCode;
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
  const [reusedAddressUTXOs, setReusedAddressUTXOs] = useState(0);

  useEffect(() => {
    getUTXOs(accountCode).then(setUtxos);
    return () => setUtxos([]);
  }, [accountCode]);

  useEffect(() => {
    const unsubscribe = syncdone((code) => {
      if (accountCode === code) {
        getUTXOs(accountCode).then(setUtxos);
      }
    });
    return () => unsubscribe();
  }, [accountCode]);

  const handleUTXOChange = (
    event: ChangeEvent<HTMLInputElement>,
    utxo: TUTXO,
  ) => {
    const target = event.target;
    const proposedUTXOs = Object.assign({}, selectedUTXOs);
    if (target.checked) {
      proposedUTXOs[utxo.outPoint] = true;
      if (utxo.addressReused) {
        setReusedAddressUTXOs(reusedAddressUTXOs + 1);
      }
    } else {
      delete proposedUTXOs[utxo.outPoint];
      if (utxo.addressReused) {
        setReusedAddressUTXOs(reusedAddressUTXOs - 1);
      }
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
                onChange={event => handleUTXOChange(event, utxo)}>
                {utxo.note && (
                  <div className={style.note}>
                    <strong>{utxo.note}{' '}</strong>
                  </div>
                )}
                <div className={style.utxoContent}>
                  <div className={style.utxoData}>
                    <div className={style.amounts}>
                      <span className={style.amount}>
                        <Amount alwaysShowAmounts amount={utxo.amount.amount} unit={utxo.amount.unit}/>
                        {' '}
                        <span className={style.unit}>
                          {utxo.amount.unit}
                        </span>
                      </span>
                      <FiatConversion alwaysShowAmounts amount={utxo.amount} unstyled noAction/>
                    </div>
                    <div className={style.address}>
                      <span className={style.label}>
                        {t('send.coincontrol.address')}:
                      </span>
                      <span className={style.shrink}>
                        {utxo.address}
                      </span>
                      <div className="m-left-quarter">
                        {utxo.addressReused ?
                          <Badge type="danger">
                            {t('send.coincontrol.addressReused')}
                          </Badge> :
                          null
                        }
                        {utxo.isChange ?
                          <Badge type="info">
                            {t('send.coincontrol.change')}
                          </Badge> :
                          null
                        }
                      </div>
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
                    <ExternalLink />
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
        {(reusedAddressUTXOs > 0) && (
          <Message type="warning">
            {t('warning.coincontrol')}
          </Message>
        )}
      </div>
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
