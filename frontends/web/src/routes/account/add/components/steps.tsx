// SPDX-License-Identifier: Apache-2.0

import React, { ReactNode } from 'react';
import { cloneElement } from 'react';
import style from './steps.module.css';

type TStepsProps = {
  current: number;
  children: ReactNode;
};

export const Steps = ({
  current,
  children
}: TStepsProps) => {
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

type TStepProps = {
  children: ReactNode;
  line?: boolean;
  status?: 'process' | 'finish' | 'wait';
  hidden?: boolean;
};

export const Step = ({
  children,
  hidden = false,
  line,
  status = 'wait',
}: TStepProps) => {
  if (hidden) {
    return null;
  }
  return (
    <div className={`
      ${style.step || ''}
      ${style[status] || ''}
      ${line && style.line || ''}
    `}>
      <div className={style.dot}></div>
      <div className={style.content}>
        {children}
      </div>
    </div>
  );
};
