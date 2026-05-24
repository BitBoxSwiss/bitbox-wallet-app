// SPDX-License-Identifier: Apache-2.0

import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUpBlue } from '@/components/icon';
import { Button } from '@/components/forms';
import style from './more-options.module.css';

type TProps = {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export const MoreOptions = ({ open, onToggle, children }: TProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className={style.moreOptionsWrap}>
        <Button
          transparent
          aria-expanded={open}
          onClick={onToggle}
        >
          <span className={style.moreOptionsLabel}>
            <ChevronUpBlue
              className={`${style.moreOptionsChevron || ''} ${open ? (style.moreOptionsChevronOpen || '') : ''}`}
            />
            {t('receive.moreOptions')}
          </span>
        </Button>
      </div>
      {open && (
        <div className={style.showMoreOptions}>
          {children}
        </div>
      )}
    </>
  );
};
