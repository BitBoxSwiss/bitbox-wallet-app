// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useContext, useEffect, useState } from 'react';
import { AppContext } from '@/contexts/AppContext';
import { CloseXDark, CloseXWhite } from '@/components/icon';
import { useDarkmode } from '@/hooks/darkmode';
import { Message } from '@/components/message/message';
import { TMessageTypes } from '@/utils/types';
import style from './status.module.css';

type TProps = {
  hidden?: boolean;
  type?: TMessageTypes;
  noIcon?: boolean;
  // used as keyName in a temporary config object. Dismissing the status is temporary and kept per session (until app is closed)
  // Use an empty string if it should be dismissible without storing it in the session  config,
  // so the status will be shown again on next mount.
  dismissibleKey: string;
  className?: string;
  children: ReactNode;
};

export const SessionStatus = ({
  hidden,
  type = 'warning',
  noIcon = false,
  dismissibleKey,
  className = '',
  children,
}: TProps) => {
  const { sessionConfig, updateSessionConfig } = useContext(AppContext);
  // note: dismissible can be falsy i.e. empty string ''
  const [show, setShow] = useState(dismissibleKey ? false : true);

  const { isDarkMode } = useDarkmode();

  useEffect(() => {
    if (dismissibleKey) {
      setShow(!sessionConfig[dismissibleKey]);
    }
  }, [dismissibleKey, sessionConfig]);

  const dismiss = async () => {
    if (!dismissibleKey) {
      return;
    }
    updateSessionConfig({
      [dismissibleKey]: true,
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

