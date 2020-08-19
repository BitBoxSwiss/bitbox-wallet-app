/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2020 Shift Crypto AG
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

import { Component, h, RenderableProps } from 'preact';
import { Input, Select } from '../../../components/forms';
import { Fiat } from '../../../components/rates/rates';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet } from '../../../utils/request';
import * as style from './feetargets.css';
import { AmountWithConversions } from './send';

export type Code = 'custom' | 'low' | 'economy' | 'normal' | 'high';

interface FeeTargetsProps {
    accountCode: string;
    disabled: boolean;
    fiatUnit: Fiat;
    proposedFee?: AmountWithConversions;
    showCalculatingFeeLabel?: boolean;
    onFeeTargetChange: (code: Code) => void;
}

export type Props = FeeTargetsProps & TranslateProps;

interface FeeTarget {
    code: Code;
    feeRateInfo: string;
}
interface State {
    feeTargets: FeeTarget[] | null;
    feeTarget?: string | null;
    expert?: boolean;
}

class FeeTargets extends Component<Props, State> {
    public readonly state: State = {
        feeTargets: null,
        feeTarget: null,
    };

    public componentDidMount() {
        this.updateFeeTargets(this.props.accountCode);
    }

    public componentWillReceiveProps({ accountCode }) {
        if (this.props.accountCode !== accountCode) {
            this.updateFeeTargets(accountCode);
        }
    }

    private updateFeeTargets = (accountCode: string) => {
        apiGet('account/' + accountCode + '/fee-targets')
            .then(({ feeTargets, expert, defaultFeeTarget }: {feeTargets: FeeTarget[], expert: boolean; defaultFeeTarget: Code}) => {
                this.setState({ feeTargets, expert });
                this.setFeeTarget(defaultFeeTarget);
            });
    }

    private handleFeeTargetChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        this.setFeeTarget(target.options[target.selectedIndex].value as Code);
    }

    private setFeeTarget = (feeTarget: Code) => {
        this.setState({ feeTarget });
        this.props.onFeeTargetChange(feeTarget);
    }

    public render(
    {
        t,
        disabled,
        fiatUnit,
        proposedFee,
        showCalculatingFeeLabel = false,
    }: RenderableProps<Props>,
    {
        feeTargets,
        feeTarget,
        expert,
    }: State) {
        if (feeTargets === null || expert === undefined) {
            return (
                <Input
                    label={t('send.priority')}
                    id="feetarget"
                    placeholder={t('send.feeTarget.placeholder')}
                    disabled
                    transparent />
            );
        }

        return (
            <div className={style.row}>
                <div className={style.column}>
                    { feeTargets.length > 0 && (
                          <Select
                              className={style.priority}
                              label={t('send.priority')}
                              id="feeTarget"
                              disabled={disabled}
                              onChange={this.handleFeeTargetChange}
                              selected={feeTarget}
                              options={feeTargets.map(({ code, feeRateInfo }) => {
                                  return {
                                      value: code,
                                      text: t(`send.feeTarget.label.${code}`) + (expert && feeRateInfo ? ' (' + feeRateInfo + ')' : ''),
                                  };
                              })} />
                      )}
                </div>
                <div className={style.column}>
                    {showCalculatingFeeLabel ? (
                        <Input
                            align="right"
                            className={style.fee}
                            disabled
                            label={t('send.fee.label')}
                            placeholder={t('send.feeTarget.placeholder')}
                            transparent
                        />
                    ) : (
                        <Input
                            align="right"
                            className={feeTargets.length > 0 ? style.fee : ''}
                            disabled={feeTarget !== 'custom'}
                            label={t('send.fee.label')}
                            id="proposedFee"
                            placeholder={t(feeTarget === 'custom' ? 'send.fee.customPlaceholder' : 'send.fee.placeholder')}
                            transparent
                            value={proposedFee && proposedFee.amount + ' ' + proposedFee.unit + (proposedFee.conversions ? ' = ' + proposedFee.conversions[fiatUnit] + ' ' + fiatUnit : '')}
                        />
                    )}
                </div>
                { feeTarget && (
                    <div>
                        <label>{t('send.feeTarget.estimate')}</label>
                        <p class={style.feeDescription}>{t('send.feeTarget.description.' + feeTarget)}</p>
                    </div>
                )}
            </div>
        );
    }
}

const TranslatedFeeTargets = translate<FeeTargetsProps>()(FeeTargets);
export { TranslatedFeeTargets as FeeTargets };
