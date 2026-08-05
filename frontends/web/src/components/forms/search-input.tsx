// SPDX-License-Identifier: Apache-2.0

import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseXDark, CloseXWhite, Loupe } from '@/components/icon';
import { Input } from './input';
import type { TInputProps } from './input';
import styles from './search-input.module.css';

type TBaseProps = Omit<TInputProps, 'children' | 'type'> & {
  /** Rendered inside the field, after the icon (e.g. a filter toggle). */
  action?: ReactNode;
};

type TClearProps = TBaseProps & {
  onClear: () => void;
  variant: 'clear';
};

type TSearchProps = TBaseProps & {
  onClear?: never;
  variant?: 'search';
};

type TProps = TClearProps | TSearchProps;

export const SearchInput = forwardRef<HTMLInputElement, TProps>((props, ref) => {
  const { t } = useTranslation();

  if (props.variant === 'clear') {
    const {
      onClear,
      variant: _variant,
      action,
      ...inputProps
    } = props;

    return (
      <Input ref={ref} type="text" {...inputProps}>
        {String(inputProps.value ?? '').trim().length > 0 ? (
          <button
            aria-label={t('generic.close')}
            className={styles.clearButton}
            onClick={onClear}
            type="button"
          >
            <CloseXDark className="show-in-lightmode" />
            <CloseXWhite className="show-in-darkmode" />
          </button>
        ) : null}
        {action}
      </Input>
    );
  }

  const {
    variant: _variant,
    action,
    ...inputProps
  } = props;

  return (
    <Input ref={ref} type="text" {...inputProps}>
      <Loupe className={styles.searchIcon} />
      {action}
    </Input>
  );
});
