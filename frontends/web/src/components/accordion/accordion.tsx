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

import { useState, ReactNode } from 'react';
import { ChevronRightDark } from '@/components/icon/icon';
import styles from './accordion.module.css';

type TAccordionProps = {
  title: string;
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  defaultOpen?: boolean;
  children: ReactNode;
};

export const Accordion = ({
  title,
  className = '',
  isOpen,
  onToggle,
  defaultOpen = false,
  children,
}: TAccordionProps) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen);

  const isControlled = isOpen !== undefined && onToggle !== undefined;
  const currentOpen = isControlled ? isOpen : internalOpen;

  const handleToggle = () => {
    if (isControlled) {
      onToggle();
    } else {
      setInternalOpen(prev => !prev);
    }
  };

  return (
    <div className={`${styles.accordion || ''} ${className}`}>
      <button
        className={styles.header}
        onClick={handleToggle}
        aria-expanded={currentOpen}
        type="button"
      >
        <span className={styles.title}>{title}</span>
        <ChevronRightDark
          className={`${styles.chevron || ''} ${currentOpen ? styles.expanded || '' : ''}`}
          width={24}
          height={24}
        />
      </button>
      {currentOpen && (
        <div className={styles.content}>
          {children}
        </div>
      )}
    </div>
  );
};