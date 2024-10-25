/**
 * Copyright 2021-2024 Shift Crypto AG
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

import { CSSProperties, ReactNode } from 'react';
import styles from './grid.module.css';

type TGridStyleProperties = CSSProperties & {
  '--row-min-height'?: string | number;
}

type TGridProps = {
  children: ReactNode;
  col?: '1' | '2';
  style?: TGridStyleProperties;
  textAlign?: 'center' | 'left';
}

export const Grid = ({
  children,
  col = '2',
  style,
  textAlign,
}: TGridProps) => {
  const classes = `
    ${styles.grid}
    ${styles[`grid-columns-${col}`]}
    ${textAlign !== undefined ? styles[textAlign] : ''}
  `;
  return (
    <section className={classes} style={style}>
      {children}
    </section>
  );
};

type TColumnProps = {
  asCard?: boolean;
  className?: string;
  children: ReactNode;
  textCenter?: boolean;
}

export const Column = ({
  asCard,
  children,
  className,
  textCenter,
}: TColumnProps) => {
  const classNames = `
    ${styles.column}
    ${asCard ? styles.columnAsCard : ''}
    ${className || ''}
    ${textCenter ? styles.textCenter : ''}
  `;
  return (
    <div className={classNames}>
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
  const classNames = `${styles.columnButtons} ${
    inline ? styles.columnButtonsInline : ''
  } ${className}`;
  return (
    <div className={classNames}>
      {children}
    </div>
  );
};
