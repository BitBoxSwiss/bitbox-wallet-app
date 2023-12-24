/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
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

import { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../../contexts/AppContext';
import { MenuDark } from '../icon';
import { SpinnerAnimation } from './SpinnerAnimation';
import style from './Spinner.module.css';

type TProps = {
  text?: string;
  guideExists: boolean;
}

const Spinner = ({ text, guideExists }: TProps) => {
  const { t } = useTranslation();

  const { toggleGuide, toggleSidebar } = useContext(AppContext);

  const handleKeyDown = (e: KeyboardEvent) => {
    e.preventDefault();
    (document.activeElement as HTMLInputElement).blur();
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={style.spinnerContainer}>
      <div className={style.togglersContainer}>
        <div className={style.togglerContainer}>
          <div className={style.toggler} onClick={toggleSidebar}>
            <MenuDark />
          </div>
        </div>
        {
          guideExists && (
            <div className={style.guideToggler} onClick={toggleGuide}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="4"></circle>
                <line x1="4.93" y1="4.93" x2="9.17" y2="9.17"></line>
                <line x1="14.83" y1="14.83" x2="19.07" y2="19.07"></line>
                <line x1="14.83" y1="9.17" x2="19.07" y2="4.93"></line>
                <line x1="14.83" y1="9.17" x2="18.36" y2="5.64"></line>
                <line x1="4.93" y1="19.07" x2="9.17" y2="14.83"></line>
              </svg>
              {t('guide.toggle.open')}
            </div>
          )
        }
      </div>
      {
        text && text.split('\n').map((line, i) => (
          <p key={`${line}-${i}`} className={style.spinnerText}>{line}</p>
        ))
      }
      <SpinnerAnimation />
      <div className={style.overlay}></div>
    </div>
  );
};

export { Spinner };
