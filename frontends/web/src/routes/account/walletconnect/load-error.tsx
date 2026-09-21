// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { Message } from '@/components/message/message';
import { View, ViewContent } from '@/components/view/view';
import { WCGuide } from './guide';

type TProps = {
  errorMessage?: string;
};

export const WCLoadError = ({ errorMessage }: TProps) => {
  const { t } = useTranslation();

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header variant="navigation" mobileBackButton title={t('walletConnect.walletConnect')} />
          <View width="620px">
            <ViewContent>
              <Message type="error">{errorMessage || t('genericError')}</Message>
              <DesktopBackButton enableEsc>{t('button.back')}</DesktopBackButton>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      <WCGuide />
    </GuideWrapper>
  );
};
