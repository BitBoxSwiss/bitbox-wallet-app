// SPDX-License-Identifier: Apache-2.0

import { SpinnerRingDark, SpinnerRingLight } from '../icon';
import style from './Spinner.module.css';

export const SpinnerRingAnimated = () => {
  return (
    <>
      <SpinnerRingDark className="show-in-lightmode" />
      <SpinnerRingLight className="show-in-darkmode" />
    </>
  );
};

export const HorizontallyCenteredSpinner = () => {
  return (
    <div className={style.horizontallyCentered}>
      <SpinnerRingAnimated />
    </div>
  );
};
