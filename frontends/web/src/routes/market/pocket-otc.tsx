// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { open } from '@/api/system';
import { PocketOTCTerms } from '@/components/terms/pocket-otc-terms';
import { Header } from '@/components/layout';
import { MobileHeader } from '../settings/components/mobile-header';
import { getPocketOTCLink } from './components/infocontent';
import style from './iframe.module.css';

export const PocketOTC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const openPocketOTC = () => {
    open(getPocketOTCLink());
    navigate(-1);
  };

  const title = t('buy.exchange.infoContent.btcdirect.disclaimer.title');

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className={style.header}>
          <Header title={
            <>
              <h2 className="hide-on-small">{title}</h2>
              <MobileHeader withGuide title={title} />
            </>
          } />
        </div>
        <div className={style.container}>
          <PocketOTCTerms
            onContinue={() => openPocketOTC()}
          />
        </div>
      </div>
    </div>
  );
};
