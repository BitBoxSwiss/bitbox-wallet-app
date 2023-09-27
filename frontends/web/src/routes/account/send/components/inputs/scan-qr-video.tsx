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

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQRScanner } from '../../../../../hooks/qrcodescanner';
import { useDevicePermission } from '../../../../../hooks/permissions';
import { SpinnerAnimation } from '../../../../../components/spinner/SpinnerAnimation';
import style from '../../send.module.css';

type TProps = {
  onResult: (result: string) => void;
}

export const ScanQRVideo = ({
  onResult,
}: TProps) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const permission = useDevicePermission('camera');
  const [loading, setLoading] = useState(true);

  useQRScanner(videoRef, {
    onResult: result => onResult(result.data),
    onError: console.error,
    onStart: () => setLoading(false)
  });

  const permissionWarning = permission !== 'granted'
    ? <div>{t('permission.camera')}</div>
    : null;

  return (
    <>
      {/*As a "side effect", this div will always
      be hidden once the camera / video component
       gets loaded.*/}
      <div className={style.spinnerAnimationContainer}>
        {loading && <SpinnerAnimation />}
        {permissionWarning}
      </div>
      <video
        className={style.qrVideo}
        ref={videoRef}
      />
    </>
  );
};
