/**
 * Copyright 2025 Shift Crypto AG
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
              width={24}
              height={24}
            />
          )}
        </button>
      )}
    </>
  );
};
