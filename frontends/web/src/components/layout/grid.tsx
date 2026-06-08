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
  textAlign?: TTextAlign;
};

/**
 * ResponsiveGrid component
 * @param className - optional className for styling, for example to overwrite --grid-min-height CSS variable
 * @param col - render a grid with 1 or 2 columns
 * @param responsive - prevent columns from breaking onto newlines (only in case of col="2")
 * @param textAlign - control text alignment
 */
export const ResponsiveGrid = ({
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
    ${textAlign && style[`align-${textAlign}`] || ''}
    ${className}
  `;
  return (
    <section className={classNames.trim()}>
      {children}
    </section>
  );
};

/**
 * Grid component (same as ResponsiveGrid but not responisve)
 * @param className - optional className for styling, for example to overwrite --grid-min-height CSS variable
 * @param col - render a grid with 1 or 2 columns
 * @param responsive - prevent columns from breaking onto newlines (only in case of col="2")
 * @param textAlign - control text alignment
 */
export const Grid = ({
  children,
  responsive = false,
  ...props
}: TGridProps) => (
  <ResponsiveGrid responsive={responsive} {...props}>
    {children}
  </ResponsiveGrid>
);

type TColumnProps = {
  asCard?: boolean;
  className?: string;
  children: ReactNode;
  col?: TCol;
  textAlign?: TTextAlign;
};

/**
 * Column component
 * @param asCard - renders a container as card style
 * @param className - optional className for styling, for example to overwrite --grid-min-height CSS variable
 * @param col - can be 1 or 2 columns, this is useful for mixing 1 and 2 col
 * @param textAlign - control text alignment
 */
export const Column = ({
  asCard,
  children,
  className,
  col = '1',
  textAlign,
}: TColumnProps) => {
  const classNames = `
    ${style.column || ''}
    ${asCard && style.columnAsCard || ''}
    ${textAlign && style[`align-${textAlign}`] || ''}
    ${style[`column-${col}`] || ''}
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
