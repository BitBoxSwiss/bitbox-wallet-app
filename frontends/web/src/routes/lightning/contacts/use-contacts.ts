// SPDX-License-Identifier: Apache-2.0

import { getLightningContacts } from '@/api/lightning';
import { useLoad } from '@/hooks/api';

export const useContacts = (address?: string, enabled = true) => useLoad(
  enabled ? () => getLightningContacts(address).catch(() => ({ success: false as const })) : null,
  [address, enabled]
);
