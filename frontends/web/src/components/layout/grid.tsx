// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import style from './grid.module.css';

type TTextAlign = 'start' | 'center' | 'end';

type TGridProps = {
  children: ReactNode;
  col?: '1' | '2';
  textAlign?: TTextAlign;
};

export const Grid = ({
  children,
  col = '2',
  textAlign,
}: TGridProps) => {
  const classNames = `
    ${style.grid || ''}
    ${style[`grid-columns-${col}`] || ''}
    ${textAlign && style[`align-${textAlign}`] || ''}
  `;
  return (
    <section className={classNames.trim()}>
      {children}
    </section>
  );
};

type TColumnProps = {
  asCard?: boolean;
  className?: string;
  children: ReactNode;
  textAlign?: TTextAlign;
};

export const Column = ({
  asCard,
  children,
  className,
  textAlign,
}: TColumnProps) => {
  const classNames = `
    ${style.column || ''}
    ${asCard && style.columnAsCard || ''}
    ${textAlign && style[`align-${textAlign}`] || ''}
    ${className || ''}
  `;
  return (
    <div className={classNames.trim()}>
      {children}
    </div>
  );
};

type TColumnButtonsProps = {
  children: ReactNode;
  className?: string;
  inline?: boolean;
};

export const ColumnButtons = ({
  children,
  className = '',
  inline,
}: TColumnButtonsProps) => {
  const classNames = `
    ${style.columnButtons || ''}
    ${inline && style.columnButtonsInline || ''}
    ${className}
  `;
  return (
    <div className={classNames.trim()}>
      {children}
    </div>
  );
};
