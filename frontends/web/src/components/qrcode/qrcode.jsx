import { h, Component } from 'preact';
import { apiGet } from '../../utils/request';

const emptyImage = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

export default class QRCode extends Component {
    state = {
        src: emptyImage
    }

    componentDidMount() {
        this.update(this.props.data);
    }

    componentWillReceiveProps({ data }) {
        if (this.props.data !== data) {
            this.update(data);
        }
    }

    update = (data) => {
        this.setState({ src: emptyImage });
        apiGet('qr?data=' + encodeURIComponent(data)).then(src => this.setState({ src }));
    }

    render({}, { src }) {
        return (
            <img
                width={256}
                height={256}
                src={src} />
        );
    }
}
