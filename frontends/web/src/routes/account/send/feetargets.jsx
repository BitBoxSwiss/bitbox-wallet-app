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

import { Component, h } from 'preact';
import { apiGet } from '../../../utils/request';
import { Select, Input } from '../../../components/forms';

export default class FeeTargets extends Component {
    state = {
        feeTargets: null,
        feeTarget: null,
    }

    componentDidMount() {
        this.updateFeeTargets(this.props.accountCode);
    }

    componentWillReceiveProps({ accountCode }) {
        if (this.props.accountCode !== accountCode) {
            this.updateFeeTargets(accountCode);
        }
    }

    updateFeeTargets = (accountCode) => {
        apiGet('account/' + accountCode + '/fee-targets').then(({ feeTargets, defaultFeeTarget }) => {
            // feeTargets.push({code: 'custom'});
            this.setState({ feeTargets });
            this.setFeeTarget(defaultFeeTarget);
        });
    }

    handleFeeTargetChange = event => {
        const feeTargets = this.state.feeTargets;
        if (feeTargets) {
            this.setFeeTarget(feeTargets[event.target.selectedIndex].code);
        }
    }

    setFeeTarget = feeTarget => {
        this.setState({ feeTarget });
        this.props.onFeeTargetChange(feeTarget);
    }

    render({
        disabled,
        label,
        placeholder,
    }, {
        feeTargets,
        feeTarget,
    }) {
        if (!feeTargets) {
            return (
                <Input
                    label={label}
                    placeholder={placeholder}
                    disabled
                    transparent />
            );
        }

        return (
            <Select
                label={label}
                id="feeTarget"
                disabled={disabled}
                onChange={this.handleFeeTargetChange}
                selected={feeTarget}
                options={feeTargets} />
        );
    }
}
