/**
 * Copyright 2018 Shift Devices AG
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

import { FunctionComponent, SyntheticEvent } from 'react';
import { route } from '../../utils/route';
import { hide } from '../guide/guide';
import { debug } from '../../utils/env';
import { apiPost } from '../../utils/request';
import style from './anchor.module.css';

interface Props {
    href: string;
    [property: string]: any;
}

const A:FunctionComponent<Props> =({ href, icon, children, ...props }) => {
  return (
    <span className={style.link} onClick={(e: SyntheticEvent) => {
      e.preventDefault();
      const { hostname, origin } = new URL(href, window.location.href);
      if (origin === 'qrc:' || (debug && hostname === window.location.hostname)) {
        hide();
        route(href);
      } else {
        apiPost('open', href);
      }
    }} title={props.title || href} {...props}>
      {icon ? icon : null}
      {children}
    </span>
  );
}

export default A;
