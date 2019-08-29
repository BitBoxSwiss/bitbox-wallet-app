/**
 * Copyright 2018 Shift Devices AG
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

import { h, cloneElement } from 'preact';
import finishIcon from '../../../../assets/icons/ok.svg';
import * as style from './steps.css';

const STATUS = Object.freeze({
    PROCESS: 'process',
    FINISH: 'finish',
    WAIT: 'wait',
});

export function Steps({
    current,
    children
}) {
    return (
        <div className="content padded">
            {
                children.map((child, index) => {
                    if (!child) return null;
                    if (child.attributes.divider) {
                        return (
                            <div className={style.divider}>»</div>
                        );
                    }
                    const step = Math.ceil(index / 2);
                    const status = step === current ? STATUS.PROCESS : (
                        step < current ? STATUS.FINISH : STATUS.WAIT
                    );
                    return cloneElement(child, {
                        step: `${step + 1}`,
                        // step: step,
                        status,
                        ...child.props,
                    });
                })
            }
        </div>
    );
}

export function Step({
    status = undefined,
    step = undefined,
    title = undefined,
    icon = undefined,
    description = undefined,
    ...props
}) {
    return (
        <div className={[style.step, style[status]].join(' ')} {...props}>
            <div className={style.stepIcon}>
                {
                    icon || (status === STATUS.FINISH ? (
                        <img src={finishIcon} />
                    ) : (
                        <span>{step}</span>
                    ))
                }
            </div>
            <p className={style.stepContent}>
                {
                    title && (
                        <span className={style.title}>{title}</span>
                    )
                }

                {
                    description && (
                        <span className={style.description}>{description}</span>
                    )
                }
            </p>
        </div>
    );
}
