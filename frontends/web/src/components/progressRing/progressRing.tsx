// SPDX-License-Identifier: Apache-2.0

import style from './progressRing.module.css';

type TProgressRingProps = {
  width: number;
  value: number;
  className?: string[] | string;
  generic?: boolean;
  isComplete?: boolean | undefined;
  isError?: boolean;
};

const ProgressRing = ({
  className,
  generic,
  isComplete,
  isError,
  value,
  width,
}: TProgressRingProps) => {
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
