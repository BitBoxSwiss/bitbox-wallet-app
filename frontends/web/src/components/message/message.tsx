// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { StatusInfo, StatusSuccess, StatusWarning, StatusError } from '@/components/icon';
import { TMessageTypes } from '@/utils/types';
import styles from './message.module.css';

type TMessageIconProps = { type: TMessageTypes; icon?: ReactNode };

const MessageIcon = ({ type, icon }: TMessageIconProps) => {
  // optional custom icon
  if (icon) {
    return icon;
  }
  switch (type) {
  case 'success':
    return (
      <StatusSuccess />
    );
  case 'info':
    return (
      <StatusInfo />
    );
  case 'error':
    return (
      <StatusError />
    );
  case 'warning':
    return (
      <StatusWarning />
    );
  default:
    return null;
  }
};

type MessageProps = {
  className?: string;
  hidden?: boolean;
  type?: TMessageTypes;
  icon?: ReactNode;
  noIcon?: boolean;
  children: ReactNode;
};

export const Message = ({
  className = '',
  hidden,
  type = 'info',
  icon,
  noIcon = false,
  children,
}: MessageProps) => {
  if (hidden) {
    return null;
  }
  return (
    <div className={`
      ${styles[type] || ''}
      ${className || ''}
    `.trim()}>
      {!noIcon && <MessageIcon type={type} icon={icon} />}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
};
