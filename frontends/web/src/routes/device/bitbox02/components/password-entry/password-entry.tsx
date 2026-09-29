// SPDX-License-Identifier: Apache-2.0

import { createRef, useEffect } from 'react';
import { runningInIOS } from '@/utils/env';
import PasswordGestureVideo from './assets/password-gestures.webm';
import PasswordGestureVideoHEVC from './assets/password-gestures.mov';
import UnlockGestureVideo from './assets/password-unlock-gestures.webm';
import UnlockGestureVideoHEVC from './assets/password-unlock-gestures.mov';
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
  // iOS WKWebView needs HEVC to preserve video transparency.
  const useHEVC = runningInIOS();
  const videos = (
    workflow === 'unlock'
      ? { webm: UnlockGestureVideo, hevc: UnlockGestureVideoHEVC }
      : { webm: PasswordGestureVideo, hevc: PasswordGestureVideoHEVC }
  );
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
        <source
          src={useHEVC ? videos.hevc : videos.webm}
          type={useHEVC ? 'video/quicktime; codecs="hvc1"' : 'video/webm; codecs="vp9"'} />
      </video>
    </div>
  );
};
