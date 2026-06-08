// SPDX-License-Identifier: Apache-2.0

import type { ChangeEvent, InputHTMLAttributes } from 'react';

export type TBaseInputProps = {
  align?: 'left' | 'right';
  children?: React.ReactNode;
  className?: string;
  classNameInputField?: string;
  error?: string | object;
  onInput?: (e: ChangeEvent<HTMLInputElement>) => void;
  transparent?: boolean;
  labelSection?: JSX.Element | undefined;
  label?: React.ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onInput'>;
