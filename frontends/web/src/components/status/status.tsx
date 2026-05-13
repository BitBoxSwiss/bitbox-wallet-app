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
  dismissibleKey: string;
  className?: string;
  children: ReactNode;
};

export const Status = ({
  hidden,
  type = 'warning',
  noIcon = false,
  dismissibleKey,
  className = '',
  children,
}: TProps) => {
  const { config, setConfig } = useConfig();
  const { isDarkMode } = useDarkmode();

  // note: dismissibleKey can be falsy i.e. empty string ''
  const show = hidden
    ? false
    : dismissibleKey
      ? !config?.frontend?.[dismissibleKey]
      : true;

  const dismiss = async () => {
    if (!dismissibleKey) {
      return;
    }
    setConfig({
      frontend: {
        [dismissibleKey]: true,
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
            hidden={!dismissibleKey}
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

