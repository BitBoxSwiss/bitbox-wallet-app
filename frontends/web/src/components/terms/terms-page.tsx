// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';

type TProps = {
  children: ReactNode;
  guide?: ReactNode;
  title: string;
};

export const TermsPage = ({ children, guide, title }: TProps) => (
  <GuideWrapper>
    <GuidedContent>
      <Main>
        <Header variant="navigation" mobileBackButton title={title} />
        {children}
      </Main>
    </GuidedContent>
    {guide}
  </GuideWrapper>
);
