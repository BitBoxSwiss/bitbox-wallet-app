/**
 * Copyright 2019 Shift Devices AG
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

import { PropsWithChildren } from 'react';
import style from './progressRing.module.css';

interface ProgressRingProps {
    width: number;
    value: number;
    className?: string[] | string;
    generic?: boolean;
    isComplete?: boolean | undefined;
    isError?: boolean;
}

const ProgressRing = ({
  className,
  generic,
  isComplete,
  isError,
  value,
  width,
}: PropsWithChildren<ProgressRingProps>) => {
  const radius = (width - 3) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = isError ? 100 : value / 100;
  const offset = circumference * (1 - progress);
  return (
    <svg
      className={[style.container, className ? className : ''].join(' ')}
      width={width}
      height={width}
      style={{ minWidth: width }}
      viewBox={`0 0 ${width} ${width}`}>
      <circle
        className={style.background}
        cx={width / 2}
        cy={width / 2}
        r={radius}
        strokeWidth={3} />
      <circle
        className={[
          style.foreground,
          !generic && isComplete ? style.complete : style.pending,
          generic && style.generic,
          isError && style.error,
        ].join(' ')}
        cx={width / 2}
        cy={width / 2}
        r={radius}
        strokeWidth={3}
        strokeDashoffset={offset}
        strokeDasharray={circumference} />
    </svg>
  );
};

export { ProgressRing };
