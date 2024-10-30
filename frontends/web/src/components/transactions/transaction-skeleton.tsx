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

import { Skeleton } from '@/components/skeleton/skeleton';
import stylesTx from './transaction.module.css';
import stylesTxSkeleton from './transaction-skeleton.module.css';

export const TransactionSkeleton = () => {
  return (
    <section className={stylesTx.tx}>
      <div className={stylesTxSkeleton.txContentSkeleton}>
        <Skeleton minWidth="32px" />
        <div className={stylesTxSkeleton.txInfoColumnSkeleton}>
          <Skeleton minWidth="70%" className={stylesTxSkeleton.skeletonStatus} />
          <Skeleton minWidth="20%" className={stylesTxSkeleton.skeletonStatus} />
        </div>
      </div>
    </section>
  );
};
