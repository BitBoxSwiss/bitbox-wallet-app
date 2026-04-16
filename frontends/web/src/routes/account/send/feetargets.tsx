// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, ChangeEvent, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RatesContext } from '@/contexts/RatesContext';
import { useLoad } from '@/hooks/api';
import * as accountApi from '@/api/account';
import { getConfig } from '@/utils/config';
import { Input } from '@/components/forms';
import { Message } from '@/components/message/message';
import { customFeeUnit, isEthereumBased } from '@/routes/account/utils';
import { Dropdown, TOption as TDropdownOption } from '@/components/dropdown/dropdown';
import style from './feetargets.module.css';

type Props = {
  accountCode: accountApi.AccountCode;
  coinCode: accountApi.CoinCode;
  disabled: boolean;
  proposedFee?: accountApi.TAmountWithConversions;
  customFee: string;
  showCalculatingFeeLabel?: boolean;
  onFeeTargetChange: (code: accountApi.FeeTargetCode) => void;
  onCustomFee: (customFee: string) => void;
  error?: string;
  // Optional preferred fee target to use instead of the default when initializing.
  preferredFeeTarget?: accountApi.FeeTargetCode;
  // Controlled value - when omitted, the component initializes the parent selection once loaded.
  value?: accountApi.FeeTargetCode;
  label?: string;
};

export const FeeTargets = ({
  accountCode,
  coinCode,
  disabled,
  proposedFee,
  customFee,
  showCalculatingFeeLabel,
  onFeeTargetChange,
  onCustomFee,
  error,
  preferredFeeTarget,
  value,
  label,
}: Props) => {
  const { t } = useTranslation();
  const { defaultCurrency } = useContext(RatesContext);
  const feeTargetLabel = label || t('send.priority');
  const config = useLoad(getConfig);
  const feeTargetList = useLoad(() => accountApi.getFeeTargetList(accountCode));

  const inputRef = useRef<HTMLInputElement & { autofocus: boolean }>(null);

  const focusInput = useCallback(() => {
    if (!disabled && inputRef.current && inputRef.current.autofocus) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const options = useMemo(() => {
    if (!config || !feeTargetList) {
      return null;
    }
    const withCustomFee = config.frontend.expertFee || feeTargetList.feeTargets.length === 0;
    const nextOptions = feeTargetList.feeTargets.map(({ code, feeRateInfo }) => ({
      value: code,
      label: t(`send.feeTarget.label.${code}`) + (withCustomFee && feeRateInfo ? ` (${feeRateInfo})` : ''),
      isDisabled: false,
    }));
    if (withCustomFee) {
      nextOptions.push({
        value: 'custom',
        label: t('send.feeTarget.label.custom'),
        isDisabled: disabled,
      });
    }
    return nextOptions;
  }, [config, disabled, feeTargetList, t]);

  useEffect(() => {
    if (!feeTargetList || !config || options === null || value !== undefined) {
      return;
    }
    const validFeeTargetCodes = options.map(option => option.value);
    const initialFeeTarget = preferredFeeTarget && validFeeTargetCodes.includes(preferredFeeTarget)
      ? preferredFeeTarget
      : feeTargetList.defaultFeeTarget;
    onFeeTargetChange(initialFeeTarget);
    if (initialFeeTarget === 'custom') {
      focusInput();
    }
  }, [config, feeTargetList, focusInput, onFeeTargetChange, options, preferredFeeTarget, value]);

  const handleCustomFee = (event: ChangeEvent<HTMLInputElement>) => {
    onCustomFee(event.target.value);
  };

  const getProposeFeeText = (): string => {
    if (!proposedFee) {
      return '';
    }
    const { amount, unit, conversions } = proposedFee;
    const conversion = conversions?.[defaultCurrency] ? ` = ${conversions[defaultCurrency]} ${defaultCurrency}` : '';
    return `${amount} ${unit} ${conversion}`;
  };

  if (options === null || !feeTargetList || !config) {
    return (
      <Input
        label={feeTargetLabel}
        id="feetarget"
        placeholder={t('send.feeTarget.placeholder')}
        disabled
        value="" />
    );
  }

  const feeTarget = value;
  const isCustom = feeTarget === 'custom';
  const hasOptions = options.length > 0;
  const proposeFeeText = getProposeFeeText();
  const preventFocus = document.activeElement && document.activeElement.nodeName === 'INPUT';
  const noFeeTargets = feeTargetList.feeTargets.length === 0;

  const renderOption = (option: TDropdownOption<accountApi.FeeTargetCode | undefined>) => {
    if (option === undefined) {
      return null;
    }

    const feeTargetInfo = feeTargetList.feeTargets.find(({ code }) => code === option.value);
    const withCustomFee = config.frontend.expertFee || feeTargetList.feeTargets.length === 0;
    if (withCustomFee && feeTargetInfo) {
      return (
        <>
          {t(`send.feeTarget.label.${option.value || ''}`)}
          {' '}
          <span className={style.unit}>
            ({feeTargetInfo.feeRateInfo || ''})
          </span>
        </>
      );
    }
    return t(`send.feeTarget.label.${option.value || ''}`);
  };

  return hasOptions ? (
    <div>
      {!isCustom ? (
        showCalculatingFeeLabel ? (
          <Input
            disabled
            className={style.calculatingFeePlaceholder}
            label={feeTargetLabel}
            placeholder={t('send.feeTarget.placeholder')}
            value="" />
        ) : (
          <>
            <label>{feeTargetLabel}</label>
            <Dropdown
              isSearchable={false}
              className={style.priority}
              renderOptions={renderOption}
              onChange={(newValue) => {
                if (newValue.value) {
                  onFeeTargetChange(newValue.value);
                }
              }}
              value={{
                label: feeTarget as string,
                value: feeTarget,
              }}
              options={options} />
          </>
        )
      ) : (
        <div className={style.rowCustomFee}>
          {noFeeTargets ? (
            <Message type="warning">
              <label>
                {t('send.noFeeTargets')}
              </label>
            </Message>
          ) : null}
          <div className={style.column}>
            <label>{feeTargetLabel}</label>
            <Dropdown
              isSearchable={false}
              className={style.priority}
              value={{
                label: feeTarget as string,
                value: feeTarget,
              }}
              id="feeTarget"
              onChange={(newValue) => {
                if (newValue.value) {
                  onFeeTargetChange(newValue.value);
                }
              }}
              renderOptions={renderOption}
              options={options} />
          </div>
          <div className={style.column}>
            <Input
              type={disabled ? 'text' : 'number'}
              min="0"
              step="any"
              autoFocus={!preventFocus}
              align="right"
              className={style.fee}
              disabled={disabled}
              label={error
                ? (
                  <span className={style.errorText}>
                    {error.trim()}
                  </span>
                )
                : t('send.feeTarget.customLabel', {
                  context: isEthereumBased(coinCode) ? 'eth' : '',
                })}
              id="proposedFee"
              placeholder={t('send.fee.customPlaceholder')}
              onInput={handleCustomFee}
              ref={inputRef}
              value={customFee}
            >
              <label
                htmlFor="proposedFee"
                className={style.customFeeUnit}>
                {customFeeUnit(coinCode)}
              </label>
            </Input>
          </div>
        </div>
      )}
      {feeTarget && !error && (
        <div className={style.feeDescription}>
          {!isCustom ? (
            <p>
              {t('send.feeTarget.estimate')}
              {' '}
              <strong>{t(`send.feeTarget.description.${feeTarget}`, { context: coinCode })}</strong>
            </p>
          ) : (
            <p>
              {t('send.fee.label')}
              {' '}
              <strong>{proposeFeeText}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  ) : null;
};
