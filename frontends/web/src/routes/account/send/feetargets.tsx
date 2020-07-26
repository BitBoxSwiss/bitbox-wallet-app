/**
 * Copyright 2018 Shift Devices AG
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
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet } from '../../../utils/request';
import { CoinCode } from '../account';

export type Code = 'low' | 'economy' | 'normal' | 'high';

interface FeeTargetsProps {
    accountCode: CoinCode;
    disabled: boolean;
    label: string;
    placeholder: string;
    onFeeTargetChange: (code: Code) => void;
}

type Props = FeeTargetsProps & TranslateProps;

interface FeeTarget {
    code: Code;
}
interface State {
    feeTargets: FeeTarget[] | null;
    feeTarget?: string | null;
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

    private updateFeeTargets = (accountCode: CoinCode) => {
        apiGet('account/' + accountCode + '/fee-targets')
        .then(({ feeTargets, defaultFeeTarget }: {feeTargets: FeeTarget[], defaultFeeTarget: Code}) => {
            // feeTargets.push({code: 'custom'});
            this.setState({ feeTargets });
            this.setFeeTarget(defaultFeeTarget);
        });
    }

    private handleFeeTargetChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const feeTargets = this.state.feeTargets;
        if (feeTargets) {
            this.setFeeTarget(feeTargets[target.selectedIndex].code);
        }
    }

    private setFeeTarget = (feeTarget: Code) => {
        this.setState({ feeTarget });
        this.props.onFeeTargetChange(feeTarget);
    }

    public render(
    {
        t,
        disabled,
        label,
        placeholder,
    }: RenderableProps<Props>,
    {
        feeTargets,
        feeTarget,
    }: State) {
        if (feeTargets === null) {
            return (
                <Input
                    label={label}
                    id="feetarget"
                    placeholder={placeholder}
                    disabled
                    transparent />
            );
        }
        if (feeTargets.length === 0) {
            return null;
        }

        return (
            <Select
                label={label}
                id="feeTarget"
                disabled={disabled}
                onChange={this.handleFeeTargetChange}
                selected={feeTarget}
                options={feeTargets.map(({ code }) => {
                    return {
                        value: code,
                        text: t(`send.feeTarget.label.${code}`),
                    };
                })} />
        );
    }
}

const TranslatedFeeTargets = translate<FeeTargetsProps>()(FeeTargets);
export { TranslatedFeeTargets as FeeTargets };
