// SPDX-License-Identifier: Apache-2.0

import { BuyInfo } from '@/components/icon/icon';
import style from './infobutton.module.css';

type TProps = { onClick: () => void };
export const InfoButton = ({ onClick, ...props }: TProps) => {
  return (
    <button onClick={onClick} {...props} className={style.button}>
      <BuyInfo />
    </button>
  );
};
