// SPDX-License-Identifier: Apache-2.0

import { CoinCode, TUsedAddress } from '@/api/account';
import { TUseAddressVerificationResult } from '../../components/use-address-verification';

export type TDialogProps = {
  verification: TUseAddressVerificationResult;
  selectedAddress: TUsedAddress | null;
  isLoading: boolean;
  coinCode?: CoinCode;
  onClose: (addressID?: string) => void;
};
