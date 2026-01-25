// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { ChevronRightDark } from '@/components/icon';
import styles from './actionable-item.module.css';

type TProps = {
  className?: string;
  disabled?: boolean;
  children: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
};

export const ActionableItem = ({
  className = '',
  disabled,
  children,
  icon,
  onClick,
}: TProps) => {
  const notButton = disabled || onClick === undefined;

  return (
    <>
      {notButton ? (
        <div className={`${styles.container || ''} ${className}`}>
          {children}
          {icon && icon}
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.container || ''} ${styles.isButton || ''} ${className}`}
          onClick={onClick}>
          {children}
          {icon ? icon : (
            <ChevronRightDark
              width={19}
              height={19}
            />
          )}
        </button>
      )}
    </>
  );
};
