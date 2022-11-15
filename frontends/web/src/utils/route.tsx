/**
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

import { useEffect } from 'react';
import { NavigateFunction, useLocation, useNavigate } from 'react-router';


type TProps = { onChange: (() => void) };

let navigate: NavigateFunction | undefined;

/**
 * @deprecated preact-router like. Use `useNavigate` hook if possible
 */
export const route = (route: string, replace?: boolean) => {
  navigate?.(route, { replace });
};

// This component makes route fn work, and triggers an onChange function
export const RouterWatcher = ({ onChange }: TProps) => {
  navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    onChange();
  }, [onChange, pathname]);
  return null;
};
