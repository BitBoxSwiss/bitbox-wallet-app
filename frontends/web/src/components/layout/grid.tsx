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

import { ReactNode } from 'react';
import style from './grid.module.css';

type TGridProps = {
  children: ReactNode;
  col?: '1' | '2';
}

export const Grid = ({ children, col }: TGridProps) => {
  return (
    <section className={`${style.grid} ${style[`grid-columns-${col || 2}`]}`}>
      {children}
    </section>
  );
};

type TColumnProps = {
  asCard?: boolean;
  className?: string;
  children: ReactNode;
}

export const Column = ({
  asCard,
  children,
  className,
}: TColumnProps) => {
  return (
    <div className={`${style.column} ${asCard ? style.columnAsCard : ''} ${className || ''}`}>
      {children}
    </div>
  );
};

type TColumnButtonsProps = {
  children: ReactNode;
  className?: string;
  inline?: boolean;
}

export const ColumnButtons = ({
  children,
  className = '',
  inline,
}: TColumnButtonsProps) => {
  const classNames = `${style.columnButtons} ${
    inline ? style.columnButtonsInline : ''
  } ${className}`;
  return (
    <div className={classNames}>
      {children}
    </div>
  );
};
