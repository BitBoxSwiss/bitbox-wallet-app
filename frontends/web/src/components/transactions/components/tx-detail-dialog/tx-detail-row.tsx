// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import styles from './tx-detail-dialog.module.css';

type Props = {
  children: ReactNode;
};
export const TxDetailRow = ({ children }: Props) => {
  return (
    <div className={styles.row}>
      {children}
    </div>
  );
};