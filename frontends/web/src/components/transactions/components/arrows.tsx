// SPDX-License-Identifier: Apache-2.0

import type { TTransactionStatus, TTransactionType } from '@/api/account';
import { ArrowFloorDownGreen, ArrowUTurn, ArrowFloorUpRed, Warning } from '@/components/icon/icon';

type TProps = {
  status?: TTransactionStatus;
  type: TTransactionType;
};

export const Arrow = ({ status, type }: TProps) => {
  if (status === 'failed') {
    return (
      <Warning />
    );
  }
  switch (type) {
  case 'send':
    return (
      <ArrowFloorUpRed />
    );
  case 'receive':
    return (
      <ArrowFloorDownGreen />
    );
  }
  return (
    <ArrowUTurn />
  );
};
