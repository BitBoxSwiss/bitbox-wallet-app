/**
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

import { ReactNode } from 'react';
import style from './badge.module.css';

type TBadgeStyles = 'success' | 'warning'; // TODO: not yet implemented 'info' | 'danger'

type TProps = {
  children: ReactNode;
  type?: TBadgeStyles;
}

export const Badge = ({
  children,
  type = 'success',
}: TProps) => {
  return (
    <span className={`${style.badge} ${style[type]}`}>
      {children}
    </span>
  );
};
