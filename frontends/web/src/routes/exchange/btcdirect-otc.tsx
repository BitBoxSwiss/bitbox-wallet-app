/**
 * Copyright 2024 Shift Crypto AG
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

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BTCDirectOTCTerms } from '@/components/terms/btcdirect-otc-terms';
import { getBTCDirectAboutUsLink } from './components/infocontent';
import { Header } from '@/components/layout';
import { open } from '@/api/system';
import style from './iframe.module.css';

export const BTCDirectOTC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const openBTCDirect = () => {
    open(getBTCDirectAboutUsLink());
    navigate(-1);
  };

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className={style.header}>
          <Header title={<h2>{t('buy.exchange.infoContent.btcdirect.disclaimer.title')}</h2>} />
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