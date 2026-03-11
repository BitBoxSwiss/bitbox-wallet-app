// SPDX-License-Identifier: Apache-2.0

import { forwardRef } from 'react';
import { Loupe } from '@/components/icon';
import { Input } from './input';
import type { TInputProps } from './input';
import styles from './search-input.module.css';

export const SearchInput = forwardRef<HTMLInputElement, TInputProps>((props, ref) => (
  <Input ref={ref} type="text" {...props}>
    <Loupe className={styles.searchIcon} />
  </Input>
));
