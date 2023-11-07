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

import { useRef } from 'react';
import { useQRScanner } from '../../../../../hooks/qrcodescanner';
import { SpinnerAnimation } from '../../../../../components/spinner/SpinnerAnimation';
import style from './scan-qr-video.module.css';

type TProps = {
  onResult: (result: string) => void;
}

export const ScanQRVideo = ({
  onResult,
}: TProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useQRScanner(videoRef, {
    onResult: result => onResult(result.data),
    onError: console.error
  });

  return (
    <>
      {/*As a "side effect", the spinner will always
      be hidden once the camera / video component
       gets loaded.*/}
      <div className={style.spinnerAnimationContainer}>
        <SpinnerAnimation />
      </div>
      <video
        className={style.qrVideo}
        ref={videoRef}
        poster="%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2264%22%20height=%2248%22%3E%3C/svg%3E"
      />
    </>
  );
};
