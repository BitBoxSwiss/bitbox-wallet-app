// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { LanguageSwitch } from '@/components/language/language';
import style from './footer.module.css';
import { Version } from './version';

type TProps = {
  children: ReactNode;
};

export const Footer = ({ children }: TProps) => {
  return (
    <footer className={[style.footer, 'flex flex-row flex-items-center flex-end'].join(' ')}>
      {children}
      <div className="m-right-half hide-on-small">
        <Version />
      </div>
      <LanguageSwitch />
    </footer>
  );
};
