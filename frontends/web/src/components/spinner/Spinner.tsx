/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023-2025 Shift Crypto AG
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

import { useContext } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { MenuDark, MenuLight } from '@/components/icon';
import { SpinnerRingAnimated } from './SpinnerAnimation';
import style from './Spinner.module.css';

type TProps = {
  text?: string;
}

export const Spinner = ({ text }: TProps) => {
  const { toggleSidebar } = useContext(AppContext);

  return (
    <div className={style.spinnerContainer}>
      <div className={`${style.togglersContainer} hide-on-small`}>
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
