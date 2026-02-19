// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { ChevronRightDark } from '@/components/icon';
import styles from './actionable-item.module.css';

type TProps = {
  className?: string;
  disabled?: boolean;
  children: ReactNode;
  icon?: ReactNode;
  leadingIcon?: ReactNode;
  onClick?: () => void;
};

export const ActionableItem = ({
  className = '',
  disabled,
  children,
  icon,
  leadingIcon,
  onClick,
}: TProps) => {
  const notButton = disabled || onClick === undefined;
  const content = leadingIcon ? (
    <div className={styles.leftContent}>
      <span className={styles.leadingIcon}>{leadingIcon}</span>
      <span>{children}</span>
    </div>
  ) : children;

  return (
    <>
      {notButton ? (
        <div className={`${styles.container || ''} ${className}`}>
          {content}
          {icon && icon}
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.container || ''} ${styles.isButton || ''} ${className}`}
          onClick={onClick}>
          {content}
          {icon ? icon : (
            <ChevronRightDark />
          )}
        </button>
      )}
    </>
  );
};
