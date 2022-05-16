/**
 * Copyright 2021 Shift Crypto AG
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

import { FunctionComponent } from 'react';
import style from './grid.module.css';

type GridProps = {}

export const Grid: FunctionComponent<GridProps> = ({ children }) => {
  return (
    <section className={style.grid}>
      {children}
    </section>
  );
}

type ColumnProps = {
    asCard?: boolean;
}

export const Column: FunctionComponent<ColumnProps> = ({
  asCard,
  children,
}) => {
  return (
    <div className={`${style.column} ${asCard ? style.columnAsCard : ''}`}>
      {children}
    </div>
  );
}

type ColumnButtonsProps = {}

export const ColumnButtons: FunctionComponent<ColumnButtonsProps> = ({ children }) => {
  return (
    <div className={style.columnButtons}>
      {children}
    </div>
  );
}
