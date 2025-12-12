// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import styles from './pillbuttongroup.module.css';

type TPillTabProps = {
  children: ReactNode;
  className?: string;
  size?: 'medium' | 'large';
};

type TPillTabButtonProps = {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
};

export const PillButtonGroup = ({
  className = '',
  size = 'medium',
  children
}: TPillTabProps) => {
  return (
    <div className={`
      ${styles.pillbuttongroup || ''}
      ${styles[size] || ''}
      ${className}`
    }>
      {children}
    </div>
  );
};

export const PillButton = ({
  active,
  children,
  onClick,
  disabled = false,
}: TPillTabButtonProps) => {
  return (
    <button
      className={active && styles.active || ''}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};