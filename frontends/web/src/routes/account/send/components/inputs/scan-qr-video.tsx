// SPDX-License-Identifier: Apache-2.0

import { useRef } from 'react';
import { useQRScanner } from '@/hooks/qrcodescanner';
import { SpinnerRingAnimated } from '@/components/spinner/SpinnerAnimation';
import style from './scan-qr-video.module.css';

type TProps = {
  onResult: (result: string) => void;
};

export const ScanQRVideo = ({
  onResult,
}: TProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const { initErrorMessage } = useQRScanner(videoRef, {
    onResult: result => onResult(result.data),
    onError: err => console.error(err),
  });

  return (
    <>
      {/*As a "side effect", the spinner will always
      be hidden once the camera / video component
       gets loaded.*/}
      <div className={style.spinnerAnimationContainer}>
        {initErrorMessage ? <p>{initErrorMessage}</p> : <SpinnerRingAnimated />}
      </div>
      <video
        className={style.qrVideo}
        ref={videoRef}
        poster="data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%3E%20width=%2264%22%20height=%2248%22%3C/svg%3E"
      />
    </>
  );
};
