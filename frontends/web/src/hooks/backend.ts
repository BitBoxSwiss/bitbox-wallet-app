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

import { useEffect, useState } from 'react';
import { TKeystores, subscribeKeystores, getKeystores } from '../api/keystores';

export function useKeystores(): TKeystores | undefined {
  const [keystores, setKeystores] = useState<TKeystores>();
  useEffect(() => {
    getKeystores().then(keystores => {
      setKeystores(keystores);
    });
    // this passes the unsubscribe function directly the return function of useEffect, used when the component unmounts.
    return subscribeKeystores(setKeystores);
  }, []);
  return keystores;
}
