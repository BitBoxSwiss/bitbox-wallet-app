import UpdatingComponent from '../updating/updating';
import style from './headerssync.css';

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

    render({

    }, {
        status,
        show,
    }) {
        if (!status || !show) {
            return null;
        }
        const total = status.targetHeight - status.tipAtInitTime;
        const value = 100 * (status.tip - status.tipAtInitTime) / total;
        const loading = total == 0 || value == 100;
        return (
            <div class={style.syncContainer}>
                <div class={style.progressBar}>
                    <div class={style.progressValue} style={{width: `${value}%`}}></div>
                </div>
                <div class={style.syncMessage}>
                    {
                        loading ? 'Done: ' : (
                            <div class={style.spinnerContainer}>
                                <div class={style.spinner}></div>
                            </div>
                        )
                    }
                    <div class={style.syncText}>{status.tip} blocks synced {!loading && `(${Math.ceil(value)}%)`}</div>
                </div>
            </div>
        );
    }
}
