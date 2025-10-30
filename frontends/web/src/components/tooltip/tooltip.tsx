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

import { useState, useRef, useEffect, ReactNode, useCallback } from 'react';
import styles from './tooltip.module.css';

type TTooltipProps = {
  trigger: ReactNode;
  content: ReactNode;
  className?: string;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  defaultOpen?: boolean;
};

export const Tooltip = ({
  trigger,
  content,
  className = '',
  isOpen,
  onToggle,
  defaultOpen = false,
}: TTooltipProps) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(defaultOpen);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isControlled = isOpen !== undefined && onToggle !== undefined;
  const currentOpen = isControlled ? isOpen : internalOpen;

  const handleOpen = () => {
    if (isControlled) {
      onToggle(true);
    } else {
      setInternalOpen(true);
    }
  };

  const handleClose = useCallback(() => {
    if (isControlled) {
      onToggle(false);
    } else {
      setInternalOpen(false);
    }
  }, [isControlled, onToggle]);

  const handleToggle = () => {
    if (isControlled) {
      onToggle(!currentOpen);
    } else {
      setInternalOpen(prev => !prev);
    }
  };

  useEffect(() => {
    if (!currentOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [currentOpen, handleClose]);

  return (
    <div
      ref={tooltipRef}
      className={`${styles.tooltip || ''} ${className}`}
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
    >
      <div className={styles.trigger} onClick={handleToggle}>
        {trigger}
      </div>
      {currentOpen && (
        <div className={styles.content}>
          {content}
        </div>
      )}
    </div>
  );
};
