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

import style from './radio.module.css';

interface IRadioProps {
  label?: string;
}

type TRadioProps = IRadioProps & JSX.IntrinsicElements['input'];

export const Radio = ({
  disabled = false,
  label,
  id,
  children,
  ...props
}: TRadioProps) => {
  return (
    <span className={style.radio}>
      <input type="radio" id={id} disabled={disabled} {...props} />
      <label htmlFor={id}>
        {label}
        {children}
      </label>
    </span>
  );
};
