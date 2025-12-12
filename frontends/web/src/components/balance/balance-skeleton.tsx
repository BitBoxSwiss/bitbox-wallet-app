// SPDX-License-Identifier: Apache-2.0

import { Skeleton } from '@/components/skeleton/skeleton';
import style from './balance-skeleton.module.css';

export const BalanceSkeleton = () => {
  return (
    <div className={style.skeletonContainer}>
      <Skeleton className={style.skeletonBalance} minWidth="50%"/>
    </div>
  );
};
