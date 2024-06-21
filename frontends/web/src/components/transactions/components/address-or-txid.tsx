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

import { CopyableInput } from '@/components/copy/Copy';
import transactionStyle from '@/components/transactions/transactions.module.css';
import parentStyle from '@/components/transactions/transaction.module.css';

type TPropsTxAddress = {
  label: string;
  addresses: string[];
}

export const TxAddress = ({
  label,
  addresses,
}: TPropsTxAddress) => {
  return (
    <div className={transactionStyle.activity}>
      <span className={parentStyle.label}>
        {label}
      </span>
      <span className={parentStyle.address}>
        {addresses[0]}
        {addresses.length > 1 && (
          <span className={parentStyle.badge}>
                    (+{addresses.length - 1})
          </span>
        )}
      </span>
    </div>
  );
};

type TPropsTxDetailCopyableValues = {
  label: string;
  values: string[];
}

export const TxDetailCopyableValues = ({
  label,
  values,
}: TPropsTxDetailCopyableValues) => {
  return (
    <div className={`${parentStyle.detail} ${parentStyle.addresses}`}>
      <label>{label}</label>
      <div className={parentStyle.detailAddresses}>
        {values.map((addrOrTxID) => (
          <CopyableInput
            key={addrOrTxID}
            alignRight
            borderLess
            flexibleHeight
            className={parentStyle.detailAddress}
            value={addrOrTxID}
          />
        ))}
      </div>
    </div>
  );
};
