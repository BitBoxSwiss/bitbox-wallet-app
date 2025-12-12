// SPDX-License-Identifier: Apache-2.0

import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, ViewButtons } from '@/components/view/view';
import { Button } from '@/components/forms';
import { ScanQRVideo } from '@/routes/account/send/components/inputs/scan-qr-video';

type TProps = {
  toggleScanQR: () => void;
  onChangeActiveScanQR: (active: boolean) => void;
  parseQRResult: (result: string) => void;
  isMobile: boolean;
};

const ScanQRDialogComponent = ({
  parseQRResult,
  toggleScanQR,
  onChangeActiveScanQR,
  isMobile,
}: TProps) => {
  const { t } = useTranslation();

  const handleResult = useCallback((result: string) => {
    parseQRResult(result);
    onChangeActiveScanQR(false);
  }, [parseQRResult, onChangeActiveScanQR]);

  return (
    <View
      fitContent
      fullscreen
      dialog={!isMobile}>
      <ScanQRVideo onResult={handleResult} />
      <ViewButtons reverseRow>
        <Button
          secondary
          onClick={toggleScanQR}>
          {t('button.back')}
        </Button>
      </ViewButtons>
    </View>
  );
};

export const ScanQRDialog = memo(ScanQRDialogComponent);
