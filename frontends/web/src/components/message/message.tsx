/**
 * Copyright 2018 Shift Devices AG
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
import { StatusInfo, StatusSuccess, StatusWarning, StatusError } from '@/components/icon';
import { TMessageTypes } from '@/utils/types';
import styles from './message.module.css';

type TMessageIconProps = { type: TMessageTypes, icon?: ReactNode };

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
  small?: boolean;
  title?: string;
  type?: TMessageTypes;
  icon?: ReactNode;
  noIcon?: boolean;
  children: ReactNode;
}

export const Message = ({
  className = '',
  hidden,
  small,
  title,
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
      ${small && styles.small || ''}
      ${className || ''}
    `.trim()}>
      {!noIcon && <MessageIcon type={type} icon={icon} />}
      <div className={styles.content}>
        {title && (
          <h2 className={`subTitle ${styles.title || ''}`}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
};
