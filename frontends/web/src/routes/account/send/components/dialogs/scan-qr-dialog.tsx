/**
 * Copyright 2023-2024 Shift Crypto AG
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

import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@/hooks/mediaquery';
import { View, ViewButtons } from '@/components/view/view';
import { Button } from '@/components/forms';
import { ScanQRVideo } from '@/routes/account/send/components/inputs/scan-qr-video';

type TProps = {
  toggleScanQR: () => void;
  onChangeActiveScanQR: (active: boolean) => void;
  parseQRResult: (result: string) => void;
}

export const ScanQRDialog = ({
  parseQRResult,
  toggleScanQR,
  onChangeActiveScanQR,
}: TProps) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <View
      fitContent
      fullscreen
      dialog={!isMobile}>
      <ScanQRVideo
        onResult={result => {
          parseQRResult(result);
          onChangeActiveScanQR(false);
        }} />
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
