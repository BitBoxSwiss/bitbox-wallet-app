import { Component } from 'preact';

import { apiGet } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';

export default class FeeTargets extends Component {
    constructor(props) {
        super(props);
        this.state = {
            feeTargets: null,
            feeTarget: null
        };
    }

    componentDidMount() {
        this.unsubscribe = apiWebsocket(this.onEvent);
        if (this.props.walletInitialized) {
            this.updateFeeTargets();
        }
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    componentWillReceiveProps({ walletInitialized }) {
        if (walletInitialized && !this.props.walletInitialized) {
            this.updateFeeTargets();
        }
    }

    onEvent = data => {
        if (data.type !== 'wallet' || data.code !== this.props.walletCode) {
            return;
        }
        switch (data.data) {
        case "feeTargetsChanged":
            this.updateFeeTargets();
            break;
        }
    };

    updateFeeTargets = () => {
        apiGet('wallet/' + this.props.walletCode + '/fee-targets').then(({ feeTargets, defaultFeeTarget }) => {
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

    render({ disabled }, { feeTargets, feeTarget }) {
        if (!feeTargets) {
            return (
                <span>Fetching fee data</span>
            );
        }
        const option = target => (
            <option
                value={ target.code }
                className="mdc-list-item"
                selected={ feeTarget === target.code }
            >{ target.code }</option>);

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
