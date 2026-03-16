// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useContext, useEffect } from 'react';
import { t } from 'i18next';
import { useTranslation } from 'react-i18next';
import { A } from '@/components/anchor/anchor';
import { CloseXWhite } from '@/components/icon';
import { AppContext } from '@/contexts/AppContext';
import { Button } from '@/components/forms';
import style from './guide.module.css';
import { getFeedbackLink, getSupportLink } from '@/utils/url_constants';

export type TProps = {
  children?: ReactNode;
  title?: string;
};

const Guide = ({ children, title = t('guide.title') }: TProps) => {
  const { guideShown, toggleGuide, setGuideExists } = useContext(AppContext);

  useEffect(() => {
    setGuideExists(true);
    return () => {
      setGuideExists(false);
    };
  }, [setGuideExists]);

  // Add/remove body class for title bar dimming
  useEffect(() => {
    if (guideShown) {
      document.body.classList.add('guideOpen');
    } else {
      document.body.classList.remove('guideOpen');
    }
    return () => {
      document.body.classList.remove('guideOpen');
    };
  }, [guideShown]);

  const { t } = useTranslation();
  return (
    <div className={style.wrapper}>
      <div className={style.overlay} onClick={toggleGuide}></div>
      <div className={[style.guide, guideShown && style.show].join(' ')}>
        <div className={[style.header, 'flex flex-row flex-between flex-items-center'].join(' ')}>
          <h2>{title}</h2>

          <Button transparent className={style.close} onClick={toggleGuide}>
            <CloseXWhite />
          </Button>
        </div>
        <div className={style.content}>
          {children}
          <div className={style.appendix}>
            {t('guide.appendix.feedback.text')}
            {' '}
            <A className={style.link} href={getFeedbackLink()}>
              {t('guide.appendix.feedback.link')}
            </A>
            <br />
            <br />
            {t('guide.appendix.text')}
            {' '}
            <A className={style.link} href={getSupportLink()}>
              {t('guide.appendix.link')}
            </A>
            <br />
            <br />
          </div>
        </div>
      </div>
    </div>
  );
};

export { Guide };
