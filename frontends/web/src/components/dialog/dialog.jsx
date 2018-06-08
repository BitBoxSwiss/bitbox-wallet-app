import { Component } from 'preact';
import style from './dialog.css';


export default class Dialog extends Component {
    state = {
        active: false,
    }

    componentDidMount() {
        setTimeout(this.activate, 10);
    }

    componentWillUnmount() {
        this.setState({ active: false });
    }

    activate = () => {
        this.setState({ active: true });
    }

    render({
        title,
        children,
        onDanger,
        onSecondary,
        onPrimary,
        small,
    },{
        active,
    }) {
        const activeClass = active ? style.active : '';
        return (
            <div class={[style.overlay, activeClass].join(' ')}>
                <div class={[style.modal, activeClass, small ? style.small : ''].join(' ')}>
                    <h3 class={style.modalHeader}>{title}</h3>
                    <div class={style.modalContent}>
                        {children}
                    </div>
                </div>
            </div>
        );
    }
}
