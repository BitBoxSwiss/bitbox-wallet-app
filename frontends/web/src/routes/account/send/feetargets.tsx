/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021-2024 Shift Crypto AG
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

import React, { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoad } from '../../../hooks/api';
import * as accountApi from '../../../api/account';
import { getConfig } from '../../../utils/config';
import { Input, Select } from '../../../components/forms';
import { Message } from '../../../components/message/message';
import { customFeeUnit, getCoinCode, isEthereumBased } from '../utils';
import style from './feetargets.module.css';

type Props = {
    accountCode: accountApi.AccountCode;
    coinCode: accountApi.CoinCode;
    disabled: boolean;
    fiatUnit: accountApi.ConversionUnit;
    proposedFee?: accountApi.IAmount;
    customFee: string;
    showCalculatingFeeLabel?: boolean;
    onFeeTargetChange: (code: accountApi.FeeTargetCode) => void;
    onCustomFee: (customFee: string) => void;
    error?: string;
}


type TOptions = {
    value: accountApi.FeeTargetCode;
    text: string;
}

export const FeeTargets = ({
  accountCode,
  coinCode,
  disabled,
  fiatUnit,
  proposedFee,
  customFee,
  showCalculatingFeeLabel,
  onFeeTargetChange,
  onCustomFee,
  error
}: Props) => {
  const { t } = useTranslation();
  const config = useLoad(getConfig);
  const [feeTarget, setFeeTarget] = useState<string>('');
  const [options, setOptions] = useState<TOptions[] | null>(null);
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
    const expert = config.frontend.expertFee || feeTargets.feeTargets.length === 0;
    const options = feeTargets.feeTargets.map(({ code, feeRateInfo }) => ({
      value: code,
      text: t(`send.feeTarget.label.${code}`) + (expert && feeRateInfo ? ` (${feeRateInfo})` : ''),
    }));
    if (expert) {
      options.push({
        value: 'custom',
        text: t('send.feeTarget.label.custom'),
      });
    }
    setOptions(options);
    setFeeTarget(feeTargets.defaultFeeTarget);
    onFeeTargetChange(feeTargets.defaultFeeTarget);
    if (feeTargets.feeTargets.length === 0) {
      setNoFeeTargets(true);
    }
    focusInput();
  }, [t, feeTargets, focusInput, accountCode, config, onFeeTargetChange]);

  const handleFeeTargetChange = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLSelectElement;
    const value = target.options[target.selectedIndex].value as accountApi.FeeTargetCode;
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
    return `${amount} ${unit} ${conversions ? ` = ${conversions[fiatUnit === 'sat' ? 'BTC' : fiatUnit]} ${fiatUnit}` : ''}`;
  };

  if (options === null) {
    return (
      <Input
        label={t('send.priority')}
        id="feetarget"
        placeholder={t('send.feeTarget.placeholder')}
        disabled
        value=""
        transparent />
    );
  }

  const isCustom = feeTarget === 'custom';
  const hasOptions = options.length > 0;
  const proposeFeeText = getProposeFeeText();
  const preventFocus = document.activeElement && document.activeElement.nodeName === 'INPUT';

  return (
    hasOptions ? (
      <div>
        {!isCustom ? (
          showCalculatingFeeLabel ? (
            <Input
              disabled
              label={t('send.priority')}
              placeholder={t('send.feeTarget.placeholder')}
              value=""
              transparent />
          ) : (
            <Select
              className={style.priority}
              label={t('send.priority')}
              id="feeTarget"
              disabled={disabled}
              onChange={handleFeeTargetChange}
              value={feeTarget}
              options={options} />
          )
        ) : (
          <div className={style.rowCustomFee}>
            { noFeeTargets ? (
              <Message small type="warning">
                {t('send.noFeeTargets')}
              </Message>
            ) : null }
            <div className={style.column}>
              <Select
                className={style.priority}
                label={t('send.priority')}
                id="feeTarget"
                disabled={disabled}
                onChange={handleFeeTargetChange}
                value={feeTarget}
                options={options} />
            </div>
            <div className={style.column}>
              <Input
                type={disabled ? 'text' : 'number'}
                min="0"
                step="any"
                autoFocus={!preventFocus}
                align="right"
                className={`${style.fee} ${style.feeCustom}`}
                disabled={disabled}
                label={t('send.feeTarget.customLabel', {
                  context: isEthereumBased(coinCode) ? 'eth' : ''
                })}
                id="proposedFee"
                placeholder={t('send.fee.customPlaceholder')}
                error={error}
                transparent
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
        { feeTarget && (
          <div>
            {(showCalculatingFeeLabel || proposeFeeText ? (
              <p className={style.feeProposed}>
                {t('send.fee.label')}:
                {' '}
                {showCalculatingFeeLabel ? t('send.feeTarget.placeholder') : proposeFeeText}
              </p>
            ) : null)}
            { !isCustom ? (
              <p className={style.feeDescription}>
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
        transparent
        value={proposeFeeText}
      />
    )
  );
};
