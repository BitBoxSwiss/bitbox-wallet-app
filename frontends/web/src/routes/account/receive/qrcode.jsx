import { h, Component } from 'preact';
import { apiGet } from '../../../utils/request';
import style from './qrcode.css';

export default class QRCode extends Component {
    state = {
        src: ''
    }

    componentDidMount() {
        this.update(this.props.data);
    }

    componentWillReceiveProps({ data }) {
        if (this.props.data != data) {
            this.update(data);
        }
    }

    update = (data) => {
        apiGet('qr?data=' + encodeURIComponent(data)).then(src => this.setState({ src }));
    }

    render({}, { src }) {
        return (
            <img
              ref={ref => this.img = ref}
              width={256}
              className={style.qrcode}
              src={src}
              />
        );
    }
}
