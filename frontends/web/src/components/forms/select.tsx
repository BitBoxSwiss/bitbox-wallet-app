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

import { useEffect, useRef, useState } from 'react';
import { getPlatformFromUA } from '@/hooks/platform';
import styles from './select.module.css';

type TOptionTextContent = {
  text: string;
};

export type TOption = JSX.IntrinsicElements['option'] & TOptionTextContent;

const useParentWidthOnWindows = () => {
  const ref = useRef<HTMLSelectElement | null>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = getPlatformFromUA(userAgent);
    if (platform !== 'windows') {
      return;
    }

    const updateWidth = () => {
      if (ref.current && ref.current.parentElement) {
        ref.current.hidden = true;
        setWidth(ref.current.parentElement.offsetWidth);
        ref.current.hidden = false;
      }
    };

    updateWidth();

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return { ref, width };
};

type TSelectProps = {
  id: string;
  label?: string;
  options: TOption[];
} & JSX.IntrinsicElements['select'];

export const Select = ({
  id,
  label,
  options = [],
  ...props
}: TSelectProps) => {
  // TODO: once Qt is updated test if the white anmiated dropdown bug still appears and remove this hack
  const { ref, width } = useParentWidthOnWindows();

  return (
    <div className={styles.select}>
      {label && <label htmlFor={id}>{label}</label>}
      <select
        id={id}
        ref={ref}
        style={width !== undefined ? { width: `${width}px` } : undefined}
        {...props}>
        {options.map(({ value, text, disabled = false }) => (
          <option
            key={String(value)}
            value={value}
            disabled={disabled}
          >
            {text}
          </option>
        ))}
      </select>
    </div>
  );
};
