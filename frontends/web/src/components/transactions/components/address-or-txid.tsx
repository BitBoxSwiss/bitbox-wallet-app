/**
 * Copyright 2024 Shift Crypto AG
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

import { CopyableInput } from '../../copy/Copy';
import transactionStyle from '../transactions.module.css';
import parentStyle from '../transaction.module.css';

type TOnlyAdresses = {
  addresses: string[];
  txid?: never;
}

type TOnlyTxID = {
  addresses?: never;
  txid: string;
}

type TProps = (TOnlyAdresses | TOnlyTxID) & {
  label: string;
  detail?: boolean;
}

export const AddressOrTxID = ({
  label,
  addresses,
  txid,
  detail,
}: TProps) => {
  const values = addresses ? addresses : [txid];

  if (!detail && txid) {
    console.error('component only shows txid in transaction details');
    return null;
  }

  return (
    detail ? (
      <div className={`${parentStyle.detail} ${parentStyle.addresses}`}>
        <label>{label}</label>
        <div className={parentStyle.detailAddresses}>
          {values.map((addr_or_txid) => (
            <CopyableInput
              key={addr_or_txid}
              alignRight
              borderLess
              flexibleHeight
              className={parentStyle.detailAddress}
              value={addr_or_txid} />
          ))}
        </div>
      </div>
    ) : (
      <div className={transactionStyle.activity}>
        <span className={parentStyle.label}>
          {label}
        </span>
        <span className={parentStyle.address}>
          {values[0]}
          {values.length > 1 && (
            <span className={parentStyle.badge}>
                    (+{values.length - 1})
            </span>
          )}
        </span>
      </div>
    )
  );
};
