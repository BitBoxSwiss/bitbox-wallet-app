// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { Toggle, TToggleProps } from '@/components/toggle/toggle';
import style from './settingsToggle.module.css';

type Props = TToggleProps & {
  children: ReactNode;
};

export const SettingsToggle = ({
  children,
  ...props
}: Props) => {
  return (
    <div className={style.setting}>
      {children}
      <Toggle {...props} />
    </div>
  );
};
