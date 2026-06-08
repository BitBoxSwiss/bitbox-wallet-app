// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import styles from './guide-wrapper.module.css';

type TProps = {
  children: ReactNode;
};

export const GuideWrapper = ({ children }: TProps) => {
  return (
    <div className={styles.contentWithGuide}>
      {children}
    </div>
  );
};

export const GuidedContent = ({ children }: TProps) => {
  return (
    <div className={styles.container}>
      {children}
    </div>
  );
};
