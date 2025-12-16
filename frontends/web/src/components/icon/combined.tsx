// SPDX-License-Identifier: Apache-2.0

import { useDarkmode } from '@/hooks/darkmode';
import { BitBox02StylizedDark, BitBox02StylizedLight, CaretDown } from './icon';
import style from './combined.module.css';

export const PointToBitBox02 = () => {
  const { isDarkMode } = useDarkmode();
  return (
    <div className={style.point2bitbox02}>
      <CaretDown className={style.caret} />
      { isDarkMode
        ? (<BitBox02StylizedLight className={style.bitbox02} />)
        : (<BitBox02StylizedDark className={style.bitbox02} />)
      }
    </div>
  );
};
