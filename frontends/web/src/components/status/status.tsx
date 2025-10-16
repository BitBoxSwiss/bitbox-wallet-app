/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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
  const [show, setShow] = useState(dismissible ? false : true);

  const { isDarkMode } = useDarkmode();

  const checkConfig = useCallback(async () => {
    if (dismissible) {
      const config = await getConfig();
      setShow(!config ? true : !config.frontend[dismissible]);
    }
  }, [dismissible]);

  useEffect(() => {
    checkConfig();
  }, [checkConfig]);

  const dismiss = async () => {
    if (!dismissible) {
      return;
    }
    setConfig({
      frontend: {
        [dismissible]: true,
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

