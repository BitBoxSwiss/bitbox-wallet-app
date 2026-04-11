// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as accountApi from '@/api/account';
import { Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import {
  SignMessageContent,
  SignMessageConfirmView,
} from './sign-message-views';
import { useSignMessageController } from './use-sign-message-controller';

type TProps = {
  accounts: accountApi.TAccount[];
  code: accountApi.AccountCode;
};

export const SignMessage = ({
  accounts,
  code,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const controller = useSignMessageController({ accounts, code });

  if (!controller.account) {
    return null;
  }

  return (
    <Main>
      <Header
        hideSidebarToggler
        title={
          <>
            <h2 className="hide-on-small">{t('signMessage.signMessage')}</h2>
            <MobileHeader onClick={() => navigate(-1)} title={t('signMessage.signMessage')} />
          </>
        }
      />
      <View fullscreen={false}>
        <ViewContent>
          <SignMessageContent controller={controller} />
        </ViewContent>
        <SignMessageConfirmView controller={controller} />
      </View>
    </Main>
  );
};
