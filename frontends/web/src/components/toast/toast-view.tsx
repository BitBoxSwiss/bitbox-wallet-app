// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { CloseXDark, CloseXWhite } from '@/components/icon';
import { Message } from '@/components/message/message';
import { useDarkmode } from '@/hooks/darkmode';
import { TMessageTypes } from '@/utils/types';
import style from './Toast.module.css';

type TToastProps = {
  type?: TMessageTypes;
  // Deprecated prop kept for compatibility with the existing callsites.
  theme?: TMessageTypes;
  icon?: ReactNode;
  className?: string;
  onClose?: () => void;
  children: ReactNode;
};

export const Toast = ({ type, theme, icon, className = '', onClose, children }: TToastProps) => {
  const resolvedType = type || theme || 'info';
  const { isDarkMode } = useDarkmode();
  const iconWithSpacing = icon ? <span className={style.icon}>{icon}</span> : undefined;
  return (
    <Message icon={iconWithSpacing} type={resolvedType} className={`${style.toast || ''} ${className || ''}`.trim()}>
      <div className={style.container}>
        <div className={style.content}>{children}</div>
        <button
          aria-label="Close toast"
          className={style.closeButton}
          hidden={!onClose}
          onClick={onClose}
          type="button">
          {isDarkMode ? <CloseXWhite /> : <CloseXDark />}
        </button>
      </div>
    </Message>
  );
};
