// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { View, ViewButtons, ViewHeader } from './view/view';
import { AppDownloadButton } from './appdownloadlink/appdownloadlink';
import { Header, Main } from './layout';

export const AppUpgradeRequired = () => {
  const { t } = useTranslation();
  return (
    <Main>
      <Header />
      <View
        fullscreen
        textCenter
        verticallyCentered
        width="840px"
        withBottomBar>
        <ViewHeader title={t('device.appUpradeRequired')} />
        <ViewButtons>
          <AppDownloadButton />
        </ViewButtons>
      </View>
    </Main>
  );
};
