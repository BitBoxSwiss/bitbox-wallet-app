// SPDX-License-Identifier: Apache-2.0

import { createRef, useEffect } from 'react';
import { passwordVideos, passwordVideoType } from '@/routes/device/bitbox02/components/password-entry/videos';
import styles from './password-entry.module.css';

const isVideoPlaying = (video: HTMLVideoElement): boolean => {
  return video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2;
};

const replayVideo = (ref: HTMLVideoElement): void => {
  if (ref && !isVideoPlaying(ref)) {
    // prevent: NotAllowedError: play() failed because the user didn't interact with the document first.
    // https://goo.gl/xX8pDD
    ref.muted = true;
    ref.play();
  }
};

type TProps = {
  workflow: 'unlock' | 'set-password';
};

export const PasswordEntry = ({ workflow }: TProps) => {
  let ref = createRef<HTMLVideoElement>();
  useEffect(() => {
    if (ref.current) {
      replayVideo(ref.current);
    }
  }, [ref]);
  return (
    <div className={styles.passwordGesturesWrapper}>
      <video
        key={workflow}
        autoPlay
        playsInline
        ref={ref}
        className={styles.passwordGestures}
        loop
        muted
        height="338"
        width="600">
        <source src={passwordVideos[workflow]} type={passwordVideoType} />
      </video>
    </div>
  );
};
