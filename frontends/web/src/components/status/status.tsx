// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { useConfig } from '@/contexts/ConfigProvider';
import { CloseXDark, CloseXWhite } from '@/components/icon';
import { useDarkmode } from '@/hooks/darkmode';
import { Message } from '@/components/message/message';
import { TMessageTypes } from '@/utils/types';
import style from './status.module.css';

type TProps = {
  hidden?: boolean;
  type?: TMessageTypes;
  noIcon?: boolean;
  // used as keyName in the config if dismissing the status should be persisted, so it is not
  // shown again. Use an empty string if it should be dismissible without storing it in the
  // config, so the status will be shown again the next time.
  dismissible: string;
  className?: string;
  children: ReactNode;
};

export const Status = ({
  hidden,
  type = 'warning',
  noIcon = false,
  dismissible,
  className = '',
  children,
}: TProps) => {
  const { config, setConfig } = useConfig();

  const { isDarkMode } = useDarkmode();

  const show = hidden
    ? false
    : dismissible
      ? !config?.frontend?.[dismissible]
      : true;

  const dismiss = async () => {
    if (!dismissible) {
      return;
    }
    setConfig({
      frontend: {
        [dismissible]: true,
      }
    });
  };

  if (!show) {
    return null;
  }

  return (
    <div className={className}>
      <Message noIcon={noIcon} type={type}>
        <div className={style.container}>
          <div className={style.content}>
            {children}
          </div>
          <button
            hidden={!dismissible}
            className={style.closeButton}
            onClick={dismiss}
          >
            {isDarkMode ? <CloseXWhite /> : <CloseXDark />}
          </button>
        </div>
      </Message>
    </div>
  );
};

