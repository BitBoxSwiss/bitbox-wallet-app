// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { connectAnyKeystore } from '@/api/keystores';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { Button } from '@/components/forms';
import { GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { SendAbortedResult } from '@/routes/account/send/components/result';

type TTopUpAbortedProps = {
  onRetry: () => void;
};

type TTopUpNoBitcoinAccountsProps = {
  hasAccounts: boolean;
};

export const TopUpSuccess = () => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header variant="navigation" title={t('lightning.topUp.title')} />
          <View textCenter verticallyCentered>
            <ViewContent withIcon="success">
              <p>{t('lightning.topUp.success.message')}</p>
              <p>{t('lightning.topUp.success.note')}</p>
            </ViewContent>
            <ViewButtons>
              <Button primary onClick={() => navigate('/lightning')}>
                {t('button.done')}
              </Button>
            </ViewButtons>
          </View>
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};

export const TopUpNoBitcoinAccounts = ({ hasAccounts }: TTopUpNoBitcoinAccountsProps) => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const handlePrimaryAction = async () => {
    // This happens only when accounts exist, but none are Bitcoin accounts.
    if (hasAccounts) {
      navigate('/settings/manage-accounts');
      return;
    }
    await connectAnyKeystore();
  };

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header
            variant="navigation"
            mobileBackButton
            onBack={() => navigate('/lightning')}
            title={t('lightning.topUp.title')}
          />
          <View textCenter verticallyCentered>
            <ViewContent>
              <p>{t('lightning.topUp.noBitcoinAccounts')}</p>
            </ViewContent>
            <ViewButtons>
              <Button primary onClick={handlePrimaryAction}>
                {hasAccounts ? t('manageAccounts.title') : t('welcome.connect')}
              </Button>
              <DesktopBackButton onClick={() => navigate('/lightning')}>
                {t('button.back')}
              </DesktopBackButton>
            </ViewButtons>
          </View>
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};

export const TopUpAborted = ({ onRetry }: TTopUpAbortedProps) => {
  const [, navigate] = useLocation();

  return (
    <SendAbortedResult
      onDone={() => navigate('/lightning')}
      onRetry={onRetry}
    />
  );
};
