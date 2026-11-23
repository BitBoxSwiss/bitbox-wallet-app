// SPDX-License-Identifier: Apache-2.0

import { getDevServers } from '@/api/environment';
import { useLoad } from './api';
import { useDefault } from './default';

export const useDevServers = () => {
  const isDevServers = useDefault(
    useLoad(
      import.meta.env.PROD
        ? () => Promise.resolve(false)
        : getDevServers
    ),
    false
  );
  return isDevServers;
};
