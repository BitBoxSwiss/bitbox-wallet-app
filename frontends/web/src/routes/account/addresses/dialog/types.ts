// SPDX-License-Identifier: Apache-2.0

import type { TCoinCode, TUsedAddress, TUsedAddressesResponse } from '@/api/account';
import type { TUseAddressVerificationResult } from '../../components/use-address-verification';

export type TDialogProps = {
  verification: TUseAddressVerificationResult;
  selectedAddress: TUsedAddress | null;
  usedAddressesResponse: TUsedAddressesResponse | undefined;
  coinCode?: TCoinCode;
  onClose: (addressID?: string) => void;
};
