// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import style from './grid.module.css';

type TTextAlign = 'start' | 'center' | 'end';
type TCol = '1' | '2';

type TGridProps = {
  children: ReactNode;
  className?: string;
  col?: TCol;
  responsive?: boolean;
  textAlign?: 'center' | 'left';
};

/**
 * Grid component
 * @param className - optional className for styling, for example to overwrite --grid-min-height CSS variable
 * @param col - render a grid with 1 or 2 columns
 * @param responsive - prevent columns from breaking onto newlines on small screen
 * @param textAlign - control text alignment
 */
export const Grid = ({
  children,
  className = '',
  col = '2',
  responsive = true,
  textAlign,
}: TGridProps) => {
  const classNames = `
    ${style.grid || ''}
    ${style[`grid-columns-${col}`] || ''}
    ${responsive ? (style.responsive || '') : ''}
    ${textAlign !== undefined && style[textAlign] || ''}
    ${className}
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
  col?: TCol;
  textAlign?: TTextAlign;
  textCenter?: boolean;
};

/**
 * Column component
 * @param asCard - renders a container as card style
 * @param className - optional className for styling, for example to overwrite --grid-min-height CSS variable
 * @param col - can be 1 or 2 columns, this is useful for mixing 1 and 2 col
 * @param textAlign - control text alignment
 * @param textCenter - (deprecated) in favor of textAlign
 */
export const Column = ({
  asCard,
  children,
  className,
  col = '1',
  textAlign,
  textCenter,
}: TColumnProps) => {
  const classNames = `
    ${style.column || ''}
    ${asCard && style.columnAsCard || ''}
    ${style[`column-${col}`] || ''}
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
