// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { LanguageSwitch } from '@/components/language/language';
import { Version } from './version';
import style from './footer.module.css';

type TProps = {
  children?: ReactNode;
  textCenter?: boolean;
};

export const Footer = ({
  children,
  textCenter,
}: TProps) => {
  return (
    <footer className={`
      ${style.footer || ''}
      ${textCenter && style.textCenter || ''}
    `.trim()}>
      {children}
      <div className="m-right-half hide-on-small">
        <Version />
      </div>
      <LanguageSwitch />
    </footer>
  );
};
