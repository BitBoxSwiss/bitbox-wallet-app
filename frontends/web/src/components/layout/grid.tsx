// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import style from './grid.module.css';

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
  const styles = `
    ${style.grid || ''}
    ${style[`grid-columns-${col}`] || ''}
    ${textAlign !== undefined && style[textAlign] || ''}
  `;
  return (
    <section className={styles}>
      {children}
    </section>
  );
};

type TColumnProps = {
  asCard?: boolean;
  className?: string;
  children: ReactNode;
  textCenter?: boolean;
};

export const Column = ({
  asCard,
  children,
  className,
  textCenter,
}: TColumnProps) => {
  const classNames = `
    ${style.column || ''}
    ${asCard && style.columnAsCard || ''}
    ${className || ''}
    ${textCenter && style.textCenter || ''}
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
