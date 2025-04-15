/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ReactNode, useContext, useEffect } from 'react';
import { t } from 'i18next';
import { useTranslation } from 'react-i18next';
import { A } from '@/components/anchor/anchor';
import { CloseXWhite } from '@/components/icon';
import { AppContext } from '@/contexts/AppContext';
import { Button } from '@/components/forms';
import style from './guide.module.css';

export type Service = {
  link: string;
  name: string;
  linkDisplay: string;
}
export type TProps = {
  children?: ReactNode;
  title?: string;
  service?: Service;
}

const Guide = ({ children, title = t('guide.title'), service }: TProps) => {
  const { guideShown, toggleGuide, setGuideExists } = useContext(AppContext);

  useEffect(() => {
    setGuideExists(true);
    return () => {
      setGuideExists(false);
    };
  }, [setGuideExists]);

  const { t } = useTranslation();
  return (
    <div className={style.wrapper}>
      <div className={[style.overlay, guideShown && style.show].join(' ')} onClick={toggleGuide}></div>
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
            {service ? (
              <>
                <span className={style.question}>{t('guide.appendix.questionService', { serviceName: service.name })}</span>
                <br />
                <br />
                {t('guide.appendix.textService', { serviceName: service.name })}
                {' '}
                {service.linkDisplay.includes('@') ? (
                  <span className={style.link}>
                    {t('guide.appendix.linkService', { link: service.linkDisplay })}
                  </span>
                ) :
                  (
                    <A className={style.link} href={service.link}>
                      {t('guide.appendix.linkService', { link: service.linkDisplay })}
                    </A>
                  )
                }
              </>
            ) : (
              <>
                {t('guide.appendix.text')}
                {' '}
                <A className={style.link} href="https://bitbox.swiss/support/">
                  {t('guide.appendix.link')}
                </A>
              </>
            )}

            <br />
            <br />
          </div>
        </div>
      </div>
    </div>
  );
};

export { Guide };
