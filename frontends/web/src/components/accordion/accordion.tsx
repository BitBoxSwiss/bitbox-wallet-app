// SPDX-License-Identifier: Apache-2.0

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
          width={19}
          height={19}
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