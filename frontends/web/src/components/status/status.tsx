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

import { FunctionComponent } from 'react';
import { useConfig } from '../../hooks/config';
import style from './status.module.css';
interface Props {
    hidden?: boolean;
    type?: 'success' | 'warning' | 'info';
    // used as keyName in the config if dismissing the status should be persisted, so it is not
    // shown again. Use an empty string if it should be dismissable without storing it in the
    // config, so the status will be shown again the next time.
    dismissable?: string;
    className?: string;
}

const Status: FunctionComponent<Props> = ({
    children,
    className,
    dismissable,
    hidden,
    type = 'warning',
}) => {
    const { config, setConfig } = useConfig();
    
    let dismissed = false;
    if (dismissable) {
        if (!config) {
            // Wait until config is loaded to prevent rendering a dismissed Status
            return null;
        }
        dismissed = !!config.frontend[dismissable]
    }

    if (hidden || dismissed) {
        return null;
    }

    const dismiss = () => {
        setConfig((config) => ({
            ...config,
            frontend: {
                ...config.frontend,
                [dismissable!]: true,
            },
        }));
    }

    return (
        <div className={[style.container, style[type], className ? className : ''].join(' ')}>
            <div className={style.status}>
                {children}
                <button
                    hidden={!dismissable}
                    className={`${style.close} ${style[`close-${type}`]}`}
                    onClick={dismiss}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default Status;
