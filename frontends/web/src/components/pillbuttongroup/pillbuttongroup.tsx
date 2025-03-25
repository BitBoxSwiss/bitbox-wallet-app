/**
 * Copyright 2024 Shift Crypto AG
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
  children,
}: TPillTabProps) => {
  return (
    <div className={`${styles.pillbuttongroup} ${styles[size]} ${className}`}>
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
      className={active ? styles.active : ''}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
