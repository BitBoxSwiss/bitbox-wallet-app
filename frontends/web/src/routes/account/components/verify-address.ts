// SPDX-License-Identifier: Apache-2.0

import { AccountCode, hasSecureOutput, verifyAddress } from '@/api/account';
import { connectKeystore } from '@/api/keystores';

type TVerifyAddressWithDeviceParams = {
  code: AccountCode;
  addressID: string;
  rootFingerprint: string;
  onSecureVerificationStart?: () => void;
};

type TVerifyAddressWithDeviceResult =
  | 'userAbort'
  | 'connectFailed'
  | 'skipDeviceVerification'
  | 'verified'
  | 'verifyFailed';

type TVerifyAddressWithDeviceResultHandlers = {
  onUserAbort: () => void;
  onConnectFailed: () => void;
  onSkipDeviceVerification: () => void;
  onVerified: () => void;
  onVerifyFailed: () => void;
};

export const verifyAddressWithDevice = async ({
  code,
  addressID,
  rootFingerprint,
  onSecureVerificationStart,
}: TVerifyAddressWithDeviceParams): Promise<TVerifyAddressWithDeviceResult> => {
  let connectResult: { success: boolean; errorCode?: string };
  try {
    connectResult = await connectKeystore(rootFingerprint);
  } catch {
    return 'connectFailed';
  }

  if (!connectResult.success) {
    return connectResult.errorCode === 'userAbort' ? 'userAbort' : 'connectFailed';
  }

  try {
    const secureOutput = await hasSecureOutput(code)();
    if (!secureOutput.hasSecureOutput) {
      return 'skipDeviceVerification';
    }
    onSecureVerificationStart?.();
    await verifyAddress(code, addressID);
    return 'verified';
  } catch {
    return 'verifyFailed';
  }
};

export const handleVerifyAddressWithDeviceResult = (
  result: TVerifyAddressWithDeviceResult,
  handlers: TVerifyAddressWithDeviceResultHandlers,
): void => {
  switch (result) {
  case 'userAbort':
    handlers.onUserAbort();
    return;
  case 'connectFailed':
    handlers.onConnectFailed();
    return;
  case 'skipDeviceVerification':
    handlers.onSkipDeviceVerification();
    return;
  case 'verified':
    handlers.onVerified();
    return;
  case 'verifyFailed':
    handlers.onVerifyFailed();
    return;
  }
};
