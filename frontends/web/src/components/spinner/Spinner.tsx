// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { MenuDark, MenuLight } from '@/components/icon';
import { SpinnerRingAnimated } from './SpinnerAnimation';
import style from './Spinner.module.css';

type TProps = {
  text?: string;
};

export const Spinner = ({ text }: TProps) => {
  const { toggleSidebar } = useContext(AppContext);

  return (
    <div className={style.spinnerContainer}>
      <div className={`${style.togglersContainer || ''} hide-on-small`}>
        <div className={style.togglerContainer}>
          <div className={style.toggler} onClick={toggleSidebar}>
            <MenuDark className="show-in-lightmode" />
            <MenuLight className="show-in-darkmode" />
          </div>
        </div>
      </div>
      <div className={style.spinner}>
        <SpinnerRingAnimated />
      </div>
      {
        text && text.split('\n').map((line, i) => (
          <p key={`${line}-${i}`} className={style.spinnerText}>{line}</p>
        ))
      }
      <div className={style.overlay}></div>
    </div>
  );
};
