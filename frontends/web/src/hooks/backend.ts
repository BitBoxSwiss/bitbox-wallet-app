// SPDX-License-Identifier: Apache-2.0

import { TKeystores, subscribeKeystores } from '@/api/keystores';
import { useSubscribe } from './api';

export const useKeystores = (): TKeystores | undefined => {
  return useSubscribe(subscribeKeystores);
};
