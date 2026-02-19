// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useRef, ChangeEvent, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { RatesContext } from '@/contexts/RatesContext';
import { useLoad } from '@/hooks/api';
import * as accountApi from '@/api/account';
import { getConfig } from '@/utils/config';
import { Input } from '@/components/forms';
import { Message } from '@/components/message/message';
import { customFeeUnit, getCoinCode, isEthereumBased } from '@/routes/account/utils';
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
};

type TOption = {
  value: accountApi.FeeTargetCode;
  label: string;
  isDisabled?: boolean;
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
  error
}: Props) => {
  const { t } = useTranslation();
  const { defaultCurrency } = useContext(RatesContext);
  const config = useLoad(getConfig);
  const [feeTarget, setFeeTarget] = useState<accountApi.FeeTargetCode>();
  const [options, setOptions] = useState<TOption[] | null>(null);
  const [noFeeTargets, setNoFeeTargets] = useState<boolean>(false);

  const feeTargets = useLoad(() => accountApi.getFeeTargetList(accountCode));

  const inputRef = useRef<HTMLInputElement & { autofocus: boolean }>(null);

  const focusInput = useCallback(() => {
    if (!disabled && inputRef.current && inputRef.current.autofocus) {
      inputRef.current.focus();
    }
  }, [disabled]);


  useEffect(() => {
    if (!config || !feeTargets) {
      return;
    }
    const withCustomFee = config.frontend.expertFee || feeTargets.feeTargets.length === 0;
    const options = feeTargets.feeTargets.map(({ code, feeRateInfo }) => ({
      value: code,
      label: t(`send.feeTarget.label.${code}`) + (withCustomFee && feeRateInfo ? ` (${feeRateInfo})` : ''),
      isDisabled: false,
    }));
    if (withCustomFee) {
      options.push({
        value: 'custom',
        label: t('send.feeTarget.label.custom'),
        isDisabled: disabled,
      });
    }
    setOptions(options);
    if (feeTarget) {
      return;
    }
    setFeeTarget(feeTargets.defaultFeeTarget);
    onFeeTargetChange(feeTargets.defaultFeeTarget);
    if (feeTargets.feeTargets.length === 0) {
      setNoFeeTargets(true);
    }
    focusInput();
  }, [t, feeTarget, feeTargets, focusInput, accountCode, config, onFeeTargetChange, disabled]);

  const handleFeeTargetChange = (value: accountApi.FeeTargetCode) => {
    setFeeTarget(value);
    onFeeTargetChange(value);
  };

  const handleCustomFee = (event: ChangeEvent<HTMLInputElement>) => {
    onCustomFee(event.target.value);
  };

  const getProposeFeeText = (): string => {
    if (!proposedFee) {
      return '';
    }
    const { amount, unit, conversions } = proposedFee;
    const conversion = (conversions && conversions[defaultCurrency]) ? ` = ${conversions[defaultCurrency]} ${defaultCurrency}` : '';
    return `${amount} ${unit} ${conversion}`;
  };

  if (options === null) {
    return (
      <Input
        label={t('send.priority')}
        id="feetarget"
        placeholder={t('send.feeTarget.placeholder')}
        disabled
        value="" />
    );
  }

  const isCustom = feeTarget === 'custom';
  const hasOptions = options.length > 0;
  const proposeFeeText = getProposeFeeText();
  const preventFocus = document.activeElement && document.activeElement.nodeName === 'INPUT';

  const renderOption = (
    option: TDropdownOption<accountApi.FeeTargetCode | undefined>
  ) => {
    if (option === undefined) {
      return null;
    }

    const feetargetInfo = feeTargets?.feeTargets.find(({ code }) => code === option.value);
    const withCustomFee = config.frontend.expertFee || feeTargets?.feeTargets.length === 0;
    if (withCustomFee && feetargetInfo) {
      return (
        <>
          {t(`send.feeTarget.label.${option.value || ''}`)}
          {' '}
          <span className={style.unit}>
            ({feetargetInfo?.feeRateInfo || ''})
          </span>
        </>
      );
    }
    return t(`send.feeTarget.label.${option.value || ''}`);
  };

  return (
    hasOptions ? (
      <div>
        {!isCustom ? (
          showCalculatingFeeLabel ? (
            <Input
              disabled
              className={style.calculatingFeePlaceholder}
              label={t('send.priority')}
              placeholder={t('send.feeTarget.placeholder')}
              value="" />
          ) : (
            <>
              <label>{t('send.priority')}</label>
              <Dropdown
                isSearchable={false}
                className={style.priority}
                renderOptions={renderOption}
                onChange={(newValue) => {
                  if (newValue.value) {
                    handleFeeTargetChange(newValue.value);
                  }
                }}
                defaultValue={[{
                  label: feeTarget as string,
                  value: feeTarget,
                }]}
                options={options} />
            </>
          )
        ) : (
          <div className={style.rowCustomFee}>
            { noFeeTargets ? (
              <Message type="warning">
                <label>
                  {t('send.noFeeTargets')}
                </label>
              </Message>
            ) : null }
            <div className={style.column}>
              <label>{t('send.priority')}</label>
              <Dropdown
                isSearchable={false}
                className={style.priority}
                defaultValue={[{
                  label: feeTarget as string,
                  value: feeTarget,
                }]}
                id="feeTarget"
                onChange={(newValue) => handleFeeTargetChange(newValue.value)}
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
                    context: isEthereumBased(coinCode) ? 'eth' : ''
                  })}
                id="proposedFee"
                placeholder={t('send.fee.customPlaceholder')}
                onInput={handleCustomFee}
                ref={inputRef}
                value={customFee}
              >
                <span className={style.customFeeUnit}>
                  { customFeeUnit(coinCode) }
                </span>
              </Input>
            </div>
          </div>
        )}
        { feeTarget && !error && (
          <div className={style.feeDescription}>
            {(showCalculatingFeeLabel || proposeFeeText ? (
              <p>
                {t('send.fee.label')}:
                {' '}
                {showCalculatingFeeLabel ? t('send.feeTarget.placeholder') : proposeFeeText}
              </p>
            ) : null)}
            { !isCustom ? (
              <p>
                {t('send.feeTarget.estimate')}
                {' '}
                {t(`send.feeTarget.description.${feeTarget}`, {
                  context: getCoinCode(coinCode) || '',
                })}
              </p>
            ) : null }
          </div>
        )}
      </div>
    ) : (
      <Input
        disabled
        label={t('send.fee.label')}
        id="proposedFee"
        placeholder={t('send.fee.placeholder')}
        error={error}
        value={proposeFeeText}
      />
    )
  );
};
