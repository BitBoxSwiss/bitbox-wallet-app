import { Component } from 'preact';

import { apiGet } from '../../../utils/request';


export default class FeeTargets extends Component {
    constructor(props) {
        super(props);
        this.state = {
            feeTargets: null,
            feeTarget: null
        };
    }

    componentDidMount() {
        if(this.props.walletInitialized) {
            this.updateFeeTargets();
        }
    }

    componentWillReceiveProps({ walletInitialized }) {
        if(walletInitialized && !this.props.walletInitialized) {
            this.updateFeeTargets();
        }
    }

    updateFeeTargets = () => {
        apiGet("wallet/" + this.props.walletCode + "/fee-targets").then(({ feeTargets, defaultFeeTarget }) => {
            this.setState({
                feeTargets: feeTargets
            });
            this.setFeeTarget(defaultFeeTarget);
        });
    }

    handleFeeTargetChange = event => {
        this.setFeeTarget(this.state.feeTargets[event.target.selectedIndex].code);
    }

    setFeeTarget = feeTarget => {
        this.setState({ feeTarget: feeTarget });
        this.props.onFeeTargetChange(feeTarget);
    }

    render({ disabled }, { feeTargets, feeTarget }) {
        if(!feeTargets) {
            return (
                <span>Fetching fee data</span>
            );
        }
        const option = target => <option
        value={ target.code }
        className="mdc-list-item"
        selected={ feeTarget == target.code }
            >{ target.code }</option>;
        return (
            <select
              disabled={disabled}
              id="feeTarget"
              className="mdc-list"
              onChange={this.handleFeeTargetChange}
              >{ feeTargets && feeTargets.map(option) }
            </select>
        );
    }
}
