import { Component } from 'preact';
import style from './Toast.css';

export default class Toast extends Component {
    state = {
        active: false,
    }

    componentDidMount() {
        setTimeout(this.show, 5);
    }

    show = () => {
        this.setState({ active: true });
        setTimeout(this.hide, 5000);
    }

    hide = () => {
        this.setState({ active: false });
        this.props.onHide();
    }

    render({
        theme,
        message,
        withGuide,
    }, {
        active,
    }) {
        return (
            <div
                class={[style.toast, style[theme], active ? style.active : '', withGuide ? style.shifted : ''].join(' ')}
                ref={toast => this.toast = toast}>
                {message}
            </div>
        );
    }
}
