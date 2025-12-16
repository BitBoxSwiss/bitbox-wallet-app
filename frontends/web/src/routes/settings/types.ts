// SPDX-License-Identifier: Apache-2.0

import type { TDevices } from '@/api/devices';

export type TPagePropsWithSettingsTabs = {
  devices: TDevices;
  hasAccounts: boolean;
};
