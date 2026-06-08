// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { TKeystores, subscribeKeystores, getKeystores } from '@/api/keystores';

export const useKeystores = (): TKeystores | undefined => {
  const [keystores, setKeystores] = useState<TKeystores>();
  useEffect(() => {
    getKeystores().then(keystores => {
      setKeystores(keystores);
    });
    // this passes the unsubscribe function directly the return function of useEffect, used when the component unmounts.
    return subscribeKeystores(setKeystores);
  }, []);
  return keystores;
};
