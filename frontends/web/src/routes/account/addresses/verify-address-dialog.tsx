// SPDX-License-Identifier: Apache-2.0

import { TDialogProps } from './dialog/types';
import { LoadingDialog } from './dialog/loading-dialog';
import { SkipWarningDialog } from './dialog/skip-warning-dialog';
import { SkippedDialog } from './dialog/skipped-dialog';
import { VerifyOnDeviceDialog } from './dialog/verify-on-device-dialog';
import { ConnectFailedDialog } from './dialog/connect-failed-dialog';

export const VerifyAddressDialog = ({ verification, selectedAddress, isLoading, coinCode, onClose }: TDialogProps) => {
  const { verifyState, hasSkipDeviceVerificationQuery } = verification;

  const isSkipWarning = verifyState === 'skipWarning' || hasSkipDeviceVerificationQuery;
  const isSkipped = verifyState === 'skipped';

  if (isSkipWarning || isSkipped) {
    if (isSkipped) {
      if (isLoading) {
        return <LoadingDialog />;
      }
      return <SkippedDialog selectedAddress={selectedAddress} coinCode={coinCode} onClose={onClose} />;
    }
    return <SkipWarningDialog verification={verification} selectedAddress={selectedAddress} onClose={onClose} />;
  }

  if (verifyState === 'connectFailed') {
    return <ConnectFailedDialog verification={verification} selectedAddress={selectedAddress} onClose={onClose} />;
  }

  if (verifyState === 'verifying' || verifyState === 'error') {
    if (isLoading) {
      return <LoadingDialog />;
    }
    return <VerifyOnDeviceDialog verification={verification} selectedAddress={selectedAddress} coinCode={coinCode} onClose={onClose} />;
  }

  return null;
};
