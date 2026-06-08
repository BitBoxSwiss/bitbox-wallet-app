// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Shield } from '@/components/icon';
import style from './insuredtag.module.css';

export const Insured = () => {
  const { t } = useTranslation();
  return (
    <Link className={style.insured} to="/bitsurance/dashboard">
      <div>
        <Shield/>
        <span>{t('account.insured')}</span>
      </div>
    </Link>
  );
};

export const InsuredShield = () => {
  return (
    <div className={`${style.insured || ''} ${style.insuredShield || ''}`}>
      <Shield/>
    </div>
  );
};
