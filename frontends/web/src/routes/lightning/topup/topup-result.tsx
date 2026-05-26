// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header title={<h2>{t('lightning.topUp.title')}</h2>} />
          <View textCenter verticallyCentered>
            <ViewContent withIcon="success">
              <p>{t('lightning.topUp.success.message')}</p>
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
  const navigate = useNavigate();
  const primaryAction = hasAccounts
    ? {
      label: t('manageAccounts.title'),
      route: '/settings/manage-accounts',
    }
    : {
      label: t('welcome.connect'),
      route: '/',
    };

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header title={<h2>{t('lightning.topUp.title')}</h2>} />
          <View textCenter verticallyCentered>
            <ViewContent>
              <p>{t('lightning.topUp.noBitcoinAccounts')}</p>
            </ViewContent>
            <ViewButtons>
              <Button primary onClick={() => navigate(primaryAction.route)}>
                {primaryAction.label}
              </Button>
              <Button secondary onClick={() => navigate('/lightning')}>
                {t('button.back')}
              </Button>
            </ViewButtons>
          </View>
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};

export const TopUpAborted = ({ onRetry }: TTopUpAbortedProps) => {
  const navigate = useNavigate();

  return (
    <SendAbortedResult
      onDone={() => navigate('/lightning')}
      onRetry={onRetry}
    />
  );
};
