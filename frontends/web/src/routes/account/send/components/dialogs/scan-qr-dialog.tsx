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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogButtons } from '../../../../../components/dialog/dialog';
import { Button } from '../../../../../components/forms';
import { SpinnerAnimation } from '../../../../../components/spinner/SpinnerAnimation';
import style from '../../send.module.css';

type TProps = {
  activeScanQR: boolean;
  onToggleScanQR: () => void;
}

export const ScanQRDialog = ({ activeScanQR, onToggleScanQR }: TProps) => {
  const { t } = useTranslation();
  const [videoLoading, setVideoLoading] = useState(true);
  const toggleScanQR = () => {
    setVideoLoading(true);
    onToggleScanQR();
  };
  return (
    <Dialog
      open={activeScanQR}
      title={t('send.scanQR')}
      onClose={toggleScanQR}>
      {videoLoading &&
        <div className={style.spinnerAnimationContainer}>
          <SpinnerAnimation />
        </div>
      }
      <video
        id="video"
        width={400}
        height={300 /* fix height to avoid ugly resize effect after open */}
        className={style.qrVideo}
        onLoadedData={() => setVideoLoading(false)}
      />

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

