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

import type { ITransaction } from '@/api/account';
import { Warning } from '@/components/icon/icon';
import { ArrowIn, ArrowOut, ArrowSelf } from './icons';

type TProps = Pick<ITransaction, 'status' | 'type'>;

export const Arrow = ({ status, type }: TProps) => {
  if (status === 'failed') {
    return <Warning style={{ maxWidth: '18px' }} />;
  }
  if (type === 'receive') {
    return <ArrowIn />;
  }
  if (type === 'send') {
    return <ArrowOut />;
  }
  return <ArrowSelf />;
};
