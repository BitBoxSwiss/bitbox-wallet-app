// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import style from './grid.module.css';

type TTextAlign = 'start' | 'center' | 'end';

type TGridProps = {
  children: ReactNode;
  col?: '1' | '2';
  textAlign?: 'center' | 'left';
};

export const Grid = ({
  children,
  col = '2',
  textAlign,
}: TGridProps) => {
  const classNames = `
    ${style.grid || ''}
    ${style[`grid-columns-${col}`] || ''}
    ${textAlign !== undefined && style[textAlign] || ''}
  `;
  return (
    <section className={classNames}>
      {children}
    </section>
  );
};

type TColumnProps = {
  asCard?: boolean;
  className?: string;
  children: ReactNode;
  textAlign?: TTextAlign;
  textCenter?: boolean;
};

export const Column = ({
  asCard,
  children,
  className,
  textAlign,
  textCenter,
}: TColumnProps) => {
  const classNames = `
    ${style.column || ''}
    ${asCard && style.columnAsCard || ''}
    ${className || ''}
    ${textAlign !== undefined
      ? (style[`align-${textAlign || ''}`] || '')
      : ''}
    ${textCenter && style.textCenter || ''}
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
    <div className={classNames}>
      {children}
    </div>
  );
};
