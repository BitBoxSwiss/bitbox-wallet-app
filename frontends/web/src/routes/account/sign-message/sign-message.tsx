// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'wouter';
import type { AccountCode } from '@/api/account';
import { useAppState } from '@/contexts/app-state-context';
import { Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { PillButton, PillButtonGroup } from '@/components/pillbuttongroup/pillbuttongroup';
import {
  SignMessageContent,
  SignMessageConfirmView,
} from './sign-message-views';
import { useSignMessageController } from './use-sign-message-controller';
import { isBitcoinBased } from '@/utils/coin';
import { AddressesContent } from '../addresses/addresses';
import { FirmwareUpgradeRequiredDialog } from '@/components/dialog/firmware-upgrade-required-dialog';
import styles from './sign-message.module.css';

type TRouteParams = {
  addressID?: string;
  code: AccountCode;
  view?: 'new' | 'used';
};

export const SignMessage = () => {
  const {
    addressID,
    code = '',
    view: viewParam,
  } = useParams<TRouteParams>();
  const view = viewParam ?? 'new';

  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { activeAccounts } = useAppState();

  const controller = useSignMessageController({ accounts: activeAccounts, code });

  if (!controller.account) {
    return null;
  }

  const activeTab = (
    view === 'used'
    || addressID !== undefined ? 'used' : 'new'
  );

  const isBtcBased = isBitcoinBased(controller.account.coinCode);

  return (
    <Main>
      {controller.firmwareUpgradeRequired && (
        <FirmwareUpgradeRequiredDialog
          open
          onClose={controller.dismissFirmwareUpgrade}
        />
      )}
      <Header
        variant="navigation"
        hideSidebarToggler
        mobileBackButton
        onBack={() => history.back()}
        title={t('signMessage.signMessage')}
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
              accounts={activeAccounts}
              code={code}
            />
          )}
        </ViewContent>
        <SignMessageConfirmView controller={controller} />
      </View>
    </Main>
  );
};
