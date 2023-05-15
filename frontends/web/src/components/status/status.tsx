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
import { getConfig, setConfig } from '../../utils/config';
import { CloseXWhite } from '../icon';
import style from './status.module.css';

type TPRops = {
    hidden?: boolean;
    type?: 'success' | 'warning' | 'info';
    // used as keyName in the config if dismissing the status should be persisted, so it is not
    // shown again. Use an empty string if it should be dismissible without storing it in the
    // config, so the status will be shown again the next time.
    dismissible?: string;
    className?: string;
    children: ReactNode;
}

export const Status = ({
  hidden,
  type = 'warning',
  dismissible,
  className,
  children,
}: TPRops) => {
  const [show, setShow] = useState(true);

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
    <div className={[style.container, style[type], className ? className : '', dismissible ? style.withCloseBtn : ''].join(' ')}>
      <div className={style.status}>
        {children}
        <button
          hidden={!dismissible}
          className={`${style.close} ${style[`close-${type}`]}`}
          onClick={dismiss}>
          <CloseXWhite />
        </button>
      </div>
    </div>
  );
};
