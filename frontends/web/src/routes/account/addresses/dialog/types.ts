// SPDX-License-Identifier: Apache-2.0

import { CoinCode, TUsedAddress, TUsedAddressesResponse } from '@/api/account';
import { TUseAddressVerificationResult } from '../../components/use-address-verification';

export type TDialogProps = {
  verification: TUseAddressVerificationResult;
  selectedAddress: TUsedAddress | null;
  usedAddressesResponse: TUsedAddressesResponse | undefined;
  coinCode?: CoinCode;
  onClose: (addressID?: string) => void;
};
