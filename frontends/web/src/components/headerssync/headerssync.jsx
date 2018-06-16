import UpdatingComponent from '../updating/updating';

export default class HeadersSync extends UpdatingComponent {
    constructor(props) {
        super(props);
        this.state = { show: false };
        this.setMap(props.coinCode);
    }

    setMap = coinCode => {
        this.map = [ { url: 'coins/' + coinCode + '/headers/status', key: 'status' } ];
    }

    componentWillReceiveProps({ coinCode }) {
        if (coinCode != this.props.coinCode) {
            this.setMap(coinCode);
            this.setState({ status: null });
            this.update(this.map);
        }
    }

    componentDidUpdate(prevProps, prevState) {
        var status = this.state.status;
        if (!status) return;
        if (prevState.status && status.tip != prevState.status.tip) {
            this.setState({ show: true });
            if (status.tip == status.targetHeight) {
                setTimeout(() => { this.setState({ show: false }); }, 5000);
            }
        }
    }

    render({}, { status, show }) {
        if (!status || !show) {
            return null;
        }
        const total = status.targetHeight - status.tipAtInitTime;
        const finished = (<span>Finished: {status.tip} blocks synced</span>);
        if (total == 0) {
            return finished;
        }
        const value = 100 * (status.tip - status.tipAtInitTime) / total;
        if (value == 100) {
            return finished;
        }
        return (
            <span>
                {status.tip} blocks synced <progress value={value} max="100">{value}%</progress>
            </span>
        );
    }
}
