// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import style from './addresses.module.css';

type TAddressType = 'receive' | 'change';

type TProps = {
  value: TAddressType;
  onChange: (value: TAddressType) => void;
};

export const AddressTypeFilter = ({ value, onChange }: TProps) => {
  const { t } = useTranslation();
  return (
    <div className={style.segmentWrap}>
      <button
        type="button"
        className={`
          ${style.segmentButton || ''} 
          ${value === 'receive' ? style.segmentButtonActive || '' : ''}
        `}
        onClick={() => onChange('receive')}
      >
        {t('addresses.filter.receiveAddresses')}
      </button>
      <button
        type="button"
        className={`
          ${style.segmentButton || ''} 
          ${value === 'change' ? style.segmentButtonActive || '' : ''}
        `}
        onClick={() => onChange('change')}
      >
        {t('addresses.filter.changeAddresses')}
      </button>
    </div>
  );
};
