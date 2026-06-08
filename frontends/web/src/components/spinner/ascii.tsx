// SPDX-License-Identifier: Apache-2.0

import style from './ascii.module.css';

export const AsciiSpinner = () => {
  return (
    <div className={style.spinnerContainer}>
      <div className={style.spinner}></div>
    </div>
  );
};
