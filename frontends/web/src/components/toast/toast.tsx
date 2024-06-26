/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2024 Shift Crypto AG
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

import { ReactNode, useEffect, useState } from 'react';
import style from './Toast.module.css';

type TProps = {
    theme: string;
    withGuide?: boolean;
    children: ReactNode;
}

export const Toast = ({ theme, withGuide = false, children }: TProps) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setTimeout(() => setActive(true), 5);
  }, []);

  return (
    <div
      className={[style.toast, style[theme], active ? style.active : '', withGuide ? style.shifted : ''].join(' ')}>
      <p>{children}</p>
    </div>
  );
};


