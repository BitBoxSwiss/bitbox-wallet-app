// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Main, Header, GuideWrapper, GuidedContent } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { Button } from '@/components/forms';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { MobileHeader } from './components/mobile-header';
import { WithSettingsTabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './types';
import { useToast } from '@/components/toast/toast';
import { TMessageTypes } from '@/utils/types';
import style from './toast-demo.module.css';

const IncomingBtcIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 17H17M9 11V1M9 11L13 7M9 11L5 7" stroke="#5E94C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BitBox02NovaIcon = () => (
  <svg width="16" height="18" viewBox="0 0 8 9" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.61718 3.4375V0.34375C6.61718 0.153614 6.46357 0 6.27343 0H1.63281C1.44267 0 1.28906 0.153614 1.28906 0.34375V3.4375C0.577934 3.4375 0 3.99717 0 4.6836V8.50782C0 8.55508 0.038672 8.59375 0.085938 8.59375H0.687504C0.734764 8.59375 0.773434 8.55508 0.773434 8.50782V4.6836C0.773434 4.42256 1.00547 4.21094 1.29013 4.21094H6.61611C6.90078 4.21094 7.13281 4.42256 7.13281 4.6836V8.50782C7.13281 8.55508 7.17148 8.59375 7.21875 8.59375H7.82031C7.86757 8.59375 7.90625 8.55508 7.90625 8.50782V4.6836C7.90625 3.99717 7.32832 3.4375 6.61718 3.4375ZM2.0625 3.4375V0.773438H5.84375V3.4375H2.0625ZM3.35156 1.46094H2.83593C2.78867 1.46094 2.75 1.49961 2.75 1.54688V2.0625C2.75 2.10977 2.78867 2.14844 2.83593 2.14844H3.35156C3.39882 2.14844 3.4375 2.10977 3.4375 2.0625V1.54688C3.4375 1.49961 3.39882 1.46094 3.35156 1.46094ZM5.07031 1.46094H4.55468C4.50742 1.46094 4.46875 1.49961 4.46875 1.54688V2.0625C4.46875 2.10977 4.50742 2.14844 4.55468 2.14844H5.07031C5.11757 2.14844 5.15625 2.10977 5.15625 2.0625V1.54688C5.15625 1.49961 5.11757 1.46094 5.07031 1.46094Z" fill="#5E94C0"/>
  </svg>
);

export const ToastDemo = ({ devices, hasAccounts }: TPagePropsWithSettingsTabs) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const show = (type: TMessageTypes, duration?: number) => {
    showToast({
      duration,
      message: t(`toastDemo.examples.${type}`),
      type,
    });
  };

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <GlobalBanners devices={devices} />
          </ContentWrapper>
          <Header
            hideSidebarToggler
            title={
              <>
                <h2 className="hide-on-small">{t('sidebar.settings')}</h2>
                <MobileHeader withGuide title={t('toastDemo.title')} />
              </>
            } />
          <View fullscreen={false}>
            <ViewContent>
              <WithSettingsTabs devices={devices} hasAccounts={hasAccounts} hideMobileMenu>
                <p className={style.description}>{t('toastDemo.description')}</p>
                <div className={style.buttons}>
                  <Button secondary onClick={() => show('info')}>
                    {t('toastDemo.buttons.info')}
                  </Button>
                  <Button secondary onClick={() => show('success')}>
                    {t('toastDemo.buttons.success')}
                  </Button>
                  <Button secondary onClick={() => show('warning')}>
                    {t('toastDemo.buttons.warning')}
                  </Button>
                  <Button secondary onClick={() => show('error')}>
                    {t('toastDemo.buttons.error')}
                  </Button>
                  <Button primary onClick={() => show('info', 12000)}>
                    {t('toastDemo.buttons.long')}
                  </Button>
                  <Button secondary onClick={() => {
                    showToast({
                      message: t('toastDemo.examples.persistent'),
                      persistent: true,
                      type: 'warning',
                    });
                  }}>
                    {t('toastDemo.buttons.persistent')}
                  </Button>
                  <Button secondary onClick={() => {
                    showToast({
                      icon: <IncomingBtcIcon />,
                      message: t('toastDemo.examples.incomingBtc'),
                      type: 'info',
                    });
                  }}>
                    {t('toastDemo.buttons.incoming')}
                  </Button>
                  <Button secondary onClick={() => {
                    showToast({
                      icon: <BitBox02NovaIcon />,
                      message: (
                        <>
                          {t('toastDemo.examples.bitbox02Nova.prefix')}
                          &nbsp;
                          <button
                            className={style.inlineLink}
                            onClick={() => navigate('/settings/no-device-connected')}
                            type="button">
                            {t('toastDemo.examples.bitbox02Nova.action')}
                          </button>
                        </>
                      ),
                      type: 'info',
                    });
                  }}>
                    {t('toastDemo.buttons.bitbox02Nova')}
                  </Button>
                </div>
              </WithSettingsTabs>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
    </GuideWrapper>
  );
};
