/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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

import React, { Component, createRef } from 'react';
import * as accountApi from '../../../api/account';
import { Input, Select } from '../../../components/forms';
import { Message } from '../../../components/message/message';
import { load } from '../../../decorators/load';
import { translate, TranslateProps } from '../../../decorators/translate';
import { customFeeUnit, getCoinCode, isEthereumBased } from '../utils';
import style from './feetargets.module.css';

interface LoadedProps {
    config: any;
}

interface FeeTargetsProps {
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

export type Props = LoadedProps & FeeTargetsProps & TranslateProps;

interface Options {
    value: accountApi.FeeTargetCode;
    text: string;
}

interface State {
    feeTarget: string;
    options: Options[] | null;
    noFeeTargets: boolean;
}

class FeeTargets extends Component<Props, State> {
  public readonly state: State = {
    feeTarget: '',
    options: null,
    noFeeTargets: false,
  };

  private input = createRef<HTMLInputElement & {autofocus: boolean}>();

  public componentDidMount() {
    this.updateFeeTargets(this.props.accountCode);
    this.focusInput();
  }

  public UNSAFE_componentWillReceiveProps({ accountCode }: Props) {
    if (this.props.accountCode !== accountCode) {
      this.updateFeeTargets(accountCode);
    }
  }

  private updateFeeTargets = (accountCode: accountApi.AccountCode) => {
    accountApi.getFeeTargetList(accountCode)
      .then(({ feeTargets, defaultFeeTarget }) => {

        const expert = this.props.config.frontend.expertFee || feeTargets.length === 0;
        const options = feeTargets.map(({ code, feeRateInfo }) => ({
          value: code,
          text: this.props.t(`send.feeTarget.label.${code}`) + (expert && feeRateInfo ? ` (${feeRateInfo})` : ''),
        }));
        if (expert) {
          options.push({
            value: 'custom',
            text: this.props.t('send.feeTarget.label.custom'),
          });
        }
        this.setState({ options });
        this.setFeeTarget(defaultFeeTarget);
        if (feeTargets.length === 0) {
          this.setState({ noFeeTargets: true });
        }
      })
      .catch(console.error);
  };

  private handleFeeTargetChange = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLSelectElement;
    this.setFeeTarget(target.options[target.selectedIndex].value as accountApi.FeeTargetCode);
  };

  private handleCustomFee = (event: Event) => {
    const target = event.target as HTMLInputElement;
    this.props.onCustomFee(target.value);
  };

  private setFeeTarget = (feeTarget: accountApi.FeeTargetCode) => {
    this.setState({ feeTarget });
    this.props.onFeeTargetChange(feeTarget);
  };

  private getProposeFeeText = (): string => {
    if (!this.props.proposedFee) {
      return '';
    }
    const { amount, unit, conversions } = this.props.proposedFee;
    const fiatUnit = this.props.fiatUnit;
    return `${amount} ${unit} ${conversions ? ` = ${conversions[fiatUnit === 'sat' ? 'BTC' : fiatUnit]} ${fiatUnit}` : ''}`;
  };

  private focusInput = () => {
    if (!this.props.disabled && this.input.current && this.input.current.autofocus) {
      this.input.current.focus();
    }
  };

  public render() {
    const {
      t,
      coinCode,
      disabled,
      error,
      showCalculatingFeeLabel = false,
      customFee,
    } = this.props;
    const {
      feeTarget,
      options,
      noFeeTargets,
    } = this.state;
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
    const proposeFeeText = this.getProposeFeeText();
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
                onChange={this.handleFeeTargetChange}
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
                  onChange={this.handleFeeTargetChange}
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
                  onInput={this.handleCustomFee}
                  ref={this.input}
                  value={customFee}
                >
                  <span className={style.customFeeUnit}>
                    { customFeeUnit(this.props.coinCode) }
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
                  {showCalculatingFeeLabel ? t('send.feeTarget.placeholder') : `${proposeFeeText}`}
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
  }
}

const loadedHOC = load<LoadedProps, FeeTargetsProps & TranslateProps>(
  { config: 'config' },
)(FeeTargets);
const TranslatedFeeTargets = translate()(loadedHOC);
export { TranslatedFeeTargets as FeeTargets };
