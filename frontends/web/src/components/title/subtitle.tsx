/**
 * Copyright 2024 Shift Crypto AG
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

import { ReactNode } from 'react';
import style from './subtitle.module.css';

type Props = {
  children: ReactNode;
  className?: string;
};

export const SubTitle = ({
  className = '',
  children
}: Props) => {
  const classNames = className ? `${style.subtitle} ${className}` : style.subtitle;
  return (
    <h2 className={classNames}>
      {children}
    </h2>
  );
};
