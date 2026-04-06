// SPDX-License-Identifier: Apache-2.0

import { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeftDark,
  ChevronRightDark,
} from '@/components/icon';
import style from './address-navigator.module.css';

type TAddressNavigatorController = {
  isUsedAddressRoute: boolean;
  availableAddressCount: number;
  activeIndex: number;
  previous: (event: SyntheticEvent) => void;
  next: (event: SyntheticEvent) => void;
};

type TProps = {
  controller: TAddressNavigatorController;
};

export const AddressNavigator = ({ controller }: TProps) => {
  const { t } = useTranslation();

  const count = controller.isUsedAddressRoute ? 1 : controller.availableAddressCount;
  const previousDisabled = controller.activeIndex === 0;
  const nextDisabled = controller.activeIndex >= controller.availableAddressCount - 1;

  if (count <= 1) {
    return (
      <div className={style.container}>
        <p className={style.label}>
          {t('signMessage.addressLabel')}
        </p>
      </div>
    );
  }

  return (
    <div className={style.container}>
      <p className={style.label}>
        {t('signMessage.addressLabel')}
      </p>
      <div className={style.navigation}>
        <button
          type="button"
          disabled={previousDisabled}
          className={style.navigationButton}
          onClick={controller.previous}
          aria-label={t('button.previous')}
        >
          {previousDisabled ? undefined : <ChevronLeftDark/>}
        </button>
        <span className={style.counter}>
          {String(controller.activeIndex + 1)}/{String(count)}
        </span>
        <button
          type="button"
          disabled={nextDisabled}
          className={style.navigationButton}
          onClick={controller.next}
          aria-label={t('button.next')}
        >
          {nextDisabled ? undefined : <ChevronRightDark />}
        </button>
      </div>
    </div>
  );
};
