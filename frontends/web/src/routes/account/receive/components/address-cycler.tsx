// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { type TReceiveAddress } from '@/api/account';
import { ChevronLeftDark, ChevronRightDark } from '@/components/icon';
import { truncateDisplayAddress } from '@/utils/address';
import style from './address-cycler.module.css';

type TProps = {
  addresses: TReceiveAddress[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
};

export const AddressCycler = ({ addresses, activeIndex, onIndexChange }: TProps) => {
  const { t } = useTranslation();

  if (addresses.length === 0) {
    return null;
  }

  return (
    <>
      <p className={style.navLabel}>
        {t('receive.getNewAddress')} ({activeIndex + 1}/{addresses.length})
      </p>
      <div className={style.navRow}>
        <button
          type="button"
          className={style.chevronBtn}
          disabled={activeIndex === 0}
          onClick={() => onIndexChange(Math.max(0, activeIndex - 1))}
        >
          <ChevronLeftDark title={t('button.previous')} />
        </button>
        <span className={style.navAddress}>
          {truncateDisplayAddress(addresses[activeIndex]?.displayAddress ?? '')}
        </span>
        <button
          type="button"
          className={style.chevronBtn}
          disabled={activeIndex >= addresses.length - 1}
          onClick={() => onIndexChange(Math.min(addresses.length - 1, activeIndex + 1))}
        >
          <ChevronRightDark title={t('button.next')} />
        </button>
      </div>
    </>
  );
};
