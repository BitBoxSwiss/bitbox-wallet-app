/**
 * Copyright 2023 Shift Crypto AG
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

import { Dialog, DialogButtons } from '../../../../../components/dialog/dialog';
import { ScanQRVideo } from '../inputs/scan-qr-video';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../../components/forms';

type TProps = {
  activeScanQR: boolean;
  toggleScanQR: () => void;
  onChangeActiveScanQR: (active: boolean) => void;
  parseQRResult: (result: string) => void;
}

export const ScanQRDialog = ({ parseQRResult, activeScanQR, toggleScanQR, onChangeActiveScanQR }: TProps) => {
  const { t } = useTranslation();

  return (
    <Dialog
      large
      open={activeScanQR}
      title={t('send.scanQR')}
      onClose={toggleScanQR}>
      <ScanQRVideo
        onResult={result => {
          parseQRResult(result);
          onChangeActiveScanQR(false);
        }} />
      <DialogButtons>
        <Button
          secondary
          onClick={toggleScanQR}>
          {t('button.back')}
        </Button>
      </DialogButtons>
    </Dialog>
  );
};
