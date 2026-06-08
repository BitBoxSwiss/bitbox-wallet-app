// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BTCDirectOTCTerms } from '@/components/terms/btcdirect-otc-terms';
import { getBTCDirectOTCLink } from './components/infocontent';
import { Header } from '@/components/layout';
import { MobileHeader } from '../settings/components/mobile-header';
import { open } from '@/api/system';
import style from './iframe.module.css';

export const BTCDirectOTC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const openBTCDirect = () => {
    open(getBTCDirectOTCLink());
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
          <BTCDirectOTCTerms
            onContinue={() => openBTCDirect()}
          />
        </div>
      </div>
    </div>
  );
};