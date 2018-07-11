import { Component } from 'preact';
import { apiGet } from '../../../utils/request';
import { Select, Input } from '../../../components/forms';

export default class FeeTargets extends Component {
    state = {
        feeTargets: null,
        feeTarget: null,
    }

    componentDidMount() {
        this.updateFeeTargets(this.props.walletCode);
    }

    componentWillReceiveProps({ walletCode }) {
        if (this.props.walletCode !== walletCode) {
            this.updateFeeTargets(walletCode);
        }
    }

    updateFeeTargets = (walletCode) => {
        apiGet('wallet/' + walletCode + '/fee-targets').then(({ feeTargets, defaultFeeTarget }) => {
            // feeTargets.push({code: 'custom'});
            this.setState({ feeTargets });
            this.setFeeTarget(defaultFeeTarget);
        });
    }

    handleFeeTargetChange = event => {
        this.setFeeTarget(this.state.feeTargets[event.target.selectedIndex].code);
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
