import { Component } from 'preact';
import { apiGet } from '../../../utils/request';
import { Select } from '../../../components/forms';

export default class FeeTargets extends Component {
    state = {
        feeTargets: null,
        feeTarget: null,
    }

    componentDidMount() {
        if (this.props.walletInitialized) {
            this.updateFeeTargets(this.props.walletCode);
        }
    }

    componentWillReceiveProps({ walletInitialized, walletCode }) {
        if (walletInitialized && !this.props.walletInitialized || this.props.walletCode !== walletCode) {
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
                <span>{placeholder}</span>
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
