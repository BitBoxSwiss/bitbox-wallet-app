// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { getConfig, setConfig } from '@/utils/config';
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
  // note: dismissible can be falsy i.e. empty string ''
  const [show, setShow] = useState(dismissibleKey ? false : true);

  const { isDarkMode } = useDarkmode();

  const checkConfig = useCallback(async () => {
    if (dismissibleKey) {
      const config = await getConfig();
      setShow(!config ? true : !config.frontend[dismissibleKey]);
    }
  }, [dismissibleKey]);

  useEffect(() => {
    checkConfig();
  }, [checkConfig]);

  const dismiss = async () => {
    if (!dismissibleKey) {
      return;
    }
    setConfig({
      frontend: {
        [dismissibleKey]: true,
      }
    });
    setShow(false);
  };

  if (hidden || !show) {
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

