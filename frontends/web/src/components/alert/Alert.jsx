import { Component } from 'preact';
import i18n from '../../i18n/i18n';
import { Button } from '../forms';
import style from './Alert.css';

export default class Alert extends Component {
    state = {
        context: '',
        active: false,
    }

    componentDidMount() {
        window.alert = this.overrideAlert;
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleClose = e => {
        this.setState({ active: false });
    }

    handleKeyDown = e => {
        if (e.keyCode === 13 && this.state.active) this.setState({ active: false });
    }

    overrideAlert = str => {
        this.setState({
            context: str,
            active: true,
        }, () => {
            this.button.base.focus();
        });
    }

    render({}, {
        context,
        active,
    }) {
        const classes = active ? [style.overlay, style.active].join(' ') : style.overlay;
        return (
            <div class={classes}>
                <div class={style.alert}>
                    {context.split('\n').map(line => <p>{line}</p>)}
                    <div style="display: flex; flex-direction: row; justify-content: flex-end;">
                        <Button
                            primary
                            ref={ref => this.button = ref}
                            onClick={this.handleClose}>
                            {i18n.t('button.ok')}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
}
