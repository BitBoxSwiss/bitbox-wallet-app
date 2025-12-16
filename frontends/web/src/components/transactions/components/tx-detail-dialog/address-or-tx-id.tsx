// SPDX-License-Identifier: Apache-2.0

import { CopyableInput } from '@/components/copy/Copy';
import styles from './tx-detail-dialog.module.css';

type Props = {
  values: string[];
};
export const AddressOrTxId = ({ values }: Props) => {
  return (
    <div className={styles.addressOrTxIdContainer}>
      {values.map((addrOrTxID) => (
        <CopyableInput
          key={addrOrTxID}
          alignRight
          borderLess
          className={styles.copyableInputContainer}
          inputFieldClassName={styles.detailAddress}
          buttonClassName={styles.copyBtn}
          value={addrOrTxID}
          displayValue={`${addrOrTxID.slice(0, 8)}...${addrOrTxID.slice(-8)}`}
        />
      ))}
    </div>
  );
};