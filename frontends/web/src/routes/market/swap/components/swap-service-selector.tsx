/**
 * Copyright 2025 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Select, { components, SingleValueProps, OptionProps } from 'react-select';
import { Label } from '@/components/forms';

type TOption<T = any> = {
  amount: string;
  icon: string;
  label: string;
  value: T;
};

// shown when selected
const CustomSingleValue = (props: SingleValueProps<TOption, false>) => {
  const { data } = props;
  return (
    <components.SingleValue {...props}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src={data.icon} style={{ width: 24, height: 24 }} />
        <span>{data.label}</span>
        <span>({data.amount})</span>
      </div>
    </components.SingleValue>
  );
};


// shown in dropdown
const CustomOption = (props: OptionProps<TOption, false>) => {
  const { data, innerProps, isFocused, isSelected } = props;

  return (
    <div
      {...innerProps}
      style={{
        backgroundColor: isFocused ? '#eee' : isSelected ? '#ddd' : 'white',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src={data.icon} style={{ width: 24, height: 24 }} />
        <span>{data.label}</span>
      </div>
      <span>{data.amount}</span>
    </div>
  );
};


export const SwapServiceSelector = () => {
  const options = [{
    amount: '1',
    icon: '',
    label: 'Thorchain',
    value: 'thor'
  }, {
    amount: '0.04',
    icon: '',
    label: 'Thorchain',
    value: 'thor'
  }];

  return (
    <section>
      <Label>
        Swapping services
      </Label>
      <Select<TOption>
        components={{
          Option: CustomOption,
          SingleValue: CustomSingleValue,
        }}
        isSearchable={false}
        options={options}
        onChange={(option) => console.log(option?.value)}
        defaultValue={options[0]}
      />
    </section>
  );
};
