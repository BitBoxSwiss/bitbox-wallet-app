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

import { ExpandIcon } from '@/components/icon/icon';
import transactionStyle from '@/components/transactions/transactions.module.css';
import parentStyle from '@/components/transactions/transaction.module.css';

type TProps = {
  onClick: () => void;
  expand: boolean;
  hideOnMedium?: boolean;
}

export const ShowDetailsButton = ({
  onClick,
  expand,
  hideOnMedium,
}: TProps) => {
  return (
    <div className={`${transactionStyle.action} ${hideOnMedium ? transactionStyle.hideOnMedium : transactionStyle.showOnMedium}`}>
      <button type="button" className={parentStyle.action} onClick={onClick}>
        <ExpandIcon expand={expand} />
      </button>
    </div>
  );
};
