// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { i18n } from '@/i18n/i18n';
import { getDeviceList } from '@/api/devices';
import { syncDeviceList } from '@/api/devicessync';
import { useSync } from '@/hooks/api';
import { useKeystores } from '@/hooks/backend';
import { useDarkmode } from '@/hooks/darkmode';
import { useDefault } from '@/hooks/default';
import { Bluetooth } from '@/components/bluetooth/bluetooth';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { Entry } from '@/components/guide/entry';
import { Guide } from '@/components/guide/guide';
import { Spinner } from '@/components/spinner/Spinner';
import { AppLogo, AppLogoInverted, SwissMadeOpenSource, SwissMadeOpenSourceDark } from '@/components/icon/logo';
import { Footer, GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { OutlinedSettingsButton } from '@/components/settingsButton/outlined-settings-button';
import { runningInIOS } from '@/utils/env';
import style from './waiting.module.css';

export const Waiting = () => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const navigate = useNavigate();
  const keystores = useKeystores();
  const devices = useDefault(useSync(getDeviceList, syncDeviceList), {});

  // BitBox01 does not have any accounts anymore, so we route directly to the device settings.
  useEffect(() => {
    const deviceValues = Object.values(devices);
    if (deviceValues.length === 1 && deviceValues[0] === 'bitbox') {
      navigate(`settings/device-settings/${Object.keys(devices)[0] as string}`);
    }
  }, [devices, navigate]);

  const loadingAccounts = (keystores !== undefined && keystores.length) || (devices !== undefined && Object.keys(devices).length);

  if (loadingAccounts) {
    return (
      <Spinner text={t('welcome.loadingAccounts')} />
    );
  }
  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <GlobalBanners devices={devices} />
          </ContentWrapper>
          <Header title={<h2>{t('welcome.title')}</h2>}>
            <OutlinedSettingsButton />
          </Header>
          <View verticallyCentered width="550px" fitContent>
            <ViewContent textAlign="center">
              <div>
                {isDarkMode ? (<AppLogoInverted />) : (<AppLogo />)}
                <p className={style.waitingText}>
                  {runningInIOS() ? t('welcome.messageIOS') : t('welcome.message')}
                </p>
                <Bluetooth />
              </div>
            </ViewContent>
          </View>
        </Main>
        <Footer>
          {isDarkMode ? (<SwissMadeOpenSourceDark />) : (<SwissMadeOpenSource />)}
        </Footer>
      </GuidedContent>
      <Guide>
        <Entry entry={{
          text: t('guide.waiting.welcome.text'),
          title: t('guide.waiting.welcome.title'),
        }} shown={true} />
        { runningInIOS() && (
          <Entry entry={{
            link: {
              text: t('guide.waiting.worksWithIos.link.text'),
              url: 'https://shop.bitbox.swiss/',
            },
            text: t('guide.waiting.worksWithIos.text'),
            title: t('guide.waiting.worksWithIos.title'),
          }} />
        )}
        <Entry entry={{
          link: {
            text: t('guide.waiting.getDevice.link.text'),
            url: 'https://shop.bitbox.swiss/',
          },
          text: t('guide.waiting.getDevice.text'),
          title: t('guide.waiting.getDevice.title'),
        }} />
        <Entry entry={{
          link: {
            text: t('guide.waiting.lostDevice.link.text'),
            url: (i18n.resolvedLanguage === 'de')
              ? 'https://bitbox.swiss/redirects/restore-wallet-without-bitbox-de/'
              : 'https://bitbox.swiss/redirects/restore-wallet-without-bitbox-en/',
          },
          text: t('guide.waiting.lostDevice.text'),
          title: t('guide.waiting.lostDevice.title'),
        }} />
        <Entry entry={{
          text: t('guide.waiting.internet.text'),
          title: t('guide.waiting.internet.title'),
        }} />
        <Entry entry={{
          text: t('guide.waiting.useWithoutDevice.text'),
          title: t('guide.waiting.useWithoutDevice.title'),
        }} />
      </Guide>
    </GuideWrapper>
  );
};
