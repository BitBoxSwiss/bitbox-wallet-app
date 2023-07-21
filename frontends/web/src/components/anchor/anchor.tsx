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

import { ReactNode, SyntheticEvent } from 'react';
import { apiPost } from '../../utils/request';
import style from './anchor.module.css';

type TProps = {
    href: string;
    children: ReactNode;
    [property: string]: any;
}

export const A = ({
  href,
  icon,
  children,
  ...props
}: TProps) => {
  return (
    <span className={style.link} onClick={(e: SyntheticEvent) => {
      e.preventDefault();
      apiPost('open', href).catch(console.error);
    }} title={props.title || href} {...props}>
      {icon ? icon : null}
      {children}
    </span>
  );
};
