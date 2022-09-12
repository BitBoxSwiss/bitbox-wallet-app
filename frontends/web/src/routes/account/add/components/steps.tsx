/**
 * Copyright 2021 Shift Devices AG
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

import React from 'react';
import { cloneElement, FunctionComponent, PropsWithChildren } from 'react';
import style from './steps.module.css';

interface Props {
    current: number;
}

export const Steps: FunctionComponent<Props> = ({
  current,
  children
}) => {
  let childrens = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement[];
  return (
    <div className={style.steps}>
      { childrens
        .filter((child) => !child.props.hidden)
        .map((child, step) => {
          if (!child) {
            return null;
          }
          const status = step === current ? 'process' : (
            step < current ? 'finish' : 'wait'
          );
          const line = (step > 0);
          return cloneElement(child, {
            step: step + 1,
            line,
            status,
          });
        }) }
    </div>
  );
};

interface StepProps {
    line?: boolean;
    status?: 'process' | 'finish' | 'wait';
    hidden?: boolean;
}

export function Step({
  children,
  hidden = false,
  line,
  status = 'wait',
}: PropsWithChildren<StepProps>) {
  if (hidden) {
    return null;
  }
  return (
    <div className={`${style.step} ${style[status]} ${line ? style.line : ''}`}>
      <div className={style.dot}></div>
      <div className={style.content}>
        {children}
      </div>
    </div>
  );
}
