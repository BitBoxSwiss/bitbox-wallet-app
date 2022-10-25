/**
 * Copyright 2021 Shift Crypto AG
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

import { createRef, PropsWithChildren, useEffect } from 'react';
import PasswordGestureVideo from './assets/password-gestures.webm';
import styles from './password-entry.module.css';

export interface IPasswordEntryProps {}

function isVideoPlaying(video: HTMLVideoElement): boolean {
  return video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2;
}

function replayVideo(ref: HTMLVideoElement): void {
  if (ref && !isVideoPlaying(ref)) {
    // prevent: NotAllowedError: play() failed because the user didn't interact with the document first.
    // https://goo.gl/xX8pDD
    ref.muted = true;
    ref.play();
  }
}

export function PasswordEntry({ children }: PropsWithChildren<IPasswordEntryProps>) {
  let ref = createRef<HTMLVideoElement>();
  useEffect(() => {
    if (ref.current) {
      replayVideo(ref.current);
    }
  }, [ref]);
  return (
    <div className={styles.passwordGesturesWrapper}>
      <video
        autoPlay
        ref={ref}
        className={styles.passwordGestures}
        loop
        muted
        height="338"
        width="600">
        <source src={PasswordGestureVideo} type="video/webm" />
        {children}
      </video>
    </div>
  );
}
