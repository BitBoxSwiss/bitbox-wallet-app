// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AccountCode, TAccount } from '@/api/account';
import { Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import { PillButton, PillButtonGroup } from '@/components/pillbuttongroup/pillbuttongroup';
import {
  SignMessageContent,
  SignMessageConfirmView,
} from './sign-message-views';
import { useSignMessageController } from './use-sign-message-controller';
import { isBitcoinBased } from '../utils';
import { AddressesContent } from '../addresses/addresses';
import styles from './sign-message.module.css';

type TProps = {
  accounts: TAccount[];
  addressID?: string;
  code: AccountCode;
  view: 'new' | 'used';
};

export const SignMessage = ({
  accounts,
  addressID,
  code,
  view,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const controller = useSignMessageController({ accounts, code });

  if (!controller.account) {
    return null;
  }

  const activeTab = view === 'used' || addressID !== undefined ? 'used' : 'new';
  const isBtcBased = isBitcoinBased(controller.account.coinCode);

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

          {isBtcBased && (
            <PillButtonGroup className={styles.pillNav} size="large">
              <PillButton
                active={activeTab === 'new'}
                onClick={() => {
                  controller.reset();
                  navigate(`/account/${code}/sign-message/new`);
                }}
              >
                {t('addresses.new')}
              </PillButton>
              <PillButton
                active={activeTab === 'used'}
                onClick={() => {
                  controller.reset();
                  navigate(`/account/${code}/sign-message/used`);
                }}
              >
                {t('addresses.title')}
              </PillButton>
            </PillButtonGroup>
          )}

          {view === 'new' ? (
            <SignMessageContent
              controller={controller}
            />
          ) : (
            <AddressesContent
              accounts={accounts}
              code={code}
            />
          )}
        </ViewContent>
        <SignMessageConfirmView controller={controller} />
      </View>
    </Main>
  );
};
