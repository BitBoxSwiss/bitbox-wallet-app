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

import { ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { share } from '../../decorators/share';
import { Store } from '../../decorators/store';
import { translate, TranslateProps } from '../../decorators/translate';
import { setConfig } from '../../utils/config';
import { apiGet } from '../../utils/request';
import A from '../anchor/anchor';
import { CloseXWhite } from '../icon';
import style from './guide.module.css';

export type TSharedProps = {
    shown: boolean;
    // eslint-disable-next-line react/no-unused-prop-types
    activeSidebar: boolean;
    // eslint-disable-next-line react/no-unused-prop-types
    sidebarStatus: string;
    // eslint-disable-next-line react/no-unused-prop-types
    guideExists: boolean;
}

export type TProps = TSharedProps & {
    children?: ReactNode;
}

export const store = new Store<TSharedProps>({
  shown: false,
  activeSidebar: false,
  sidebarStatus: '',
  guideExists: false,
});

// if apiGet() is invoked immediately this can error due to cyclic dependencies
// request.js:64 Uncaught TypeError: Cannot read properties of undefined
// (reading 'runningInQtWebEngine')
// TODO: this should probably be in a context
setTimeout(() => {
  apiGet('config').then(({ frontend }) => {
    if (frontend && frontend.guideShown !== undefined) {
      store.setState({ shown: frontend.guideShown });
    } else {
      store.setState({ shown: true });
    }
  });
}, 0);

function setGuideShown(shown: boolean) {
  store.setState({ shown });
  setConfig({ frontend: { guideShown: shown } });
}

export function toggle() {
  setGuideShown(!store.state.shown);
}

export function show() {
  setGuideShown(true);
}

export function hide() {
  setGuideShown(false);
}

const Guide = ({ shown, children }: TProps) => {

  useEffect(() => {
    store.setState({ guideExists: true });
    return () => {
      store.setState({ guideExists: false });
    };
  }, []);

  const { t } = useTranslation();
  return (
    <div className={style.wrapper}>
      <div className={[style.overlay, shown && style.show].join(' ')} onClick={toggle}></div>
      <div className={[style.guide, shown && style.show].join(' ')}>
        <div className={[style.header, 'flex flex-row flex-between flex-items-center'].join(' ')}>
          <h2>{t('guide.title')}</h2>
          <a href="#" className={style.close} onClick={toggle}>
            {t('guide.toggle.close')}
            <CloseXWhite />
          </a>
        </div>
        <div className={style.content}>
          {children}
          <div className={style.entry}>
            {t('guide.appendix.text')}
            {' '}
            <A href="https://bitbox.swiss/support/">{t('guide.appendix.link')}</A>
            <br />
            <br />
          </div>
        </div>
      </div>
    </div>
  );
};

const HOC = translate()(share<TSharedProps, TranslateProps>(store)(Guide));
export { HOC as Guide };
