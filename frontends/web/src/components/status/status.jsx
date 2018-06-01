import { Component } from 'preact';
import { Button } from '../forms';
import { apiGet, apiPost } from '../../utils/request';
import style from './status.css';


export default class Status extends Component {
    state = {
        show: null,
    }

    componentDidMount() {
        this.checkConfig();
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.keyName !== prevProps.keyName) {
            this.checkConfig();
        }
    }

    checkConfig() {
        if (this.props.dismissable && this.props.keyName) {
            apiGet('config').then(({ frontend }) => {
                this.setState({
                    show: !frontend ? true : !frontend[this.props.keyName],
                });
            });
        }
    }

    dismiss = e => {
        apiGet('config').then(config => {
            const newConf = {
                ...config,
                frontend: {
                    ...config.frontend,
                    [this.props.keyName]: true
                }
            };
            apiPost('config', newConf);
        });
        this.setState({
            show: false
        });
    }

    render({
        type = 'warning',
        dismissable,
        children,
    }, {
        show,
    }) {
        if ((dismissable && !show) || (children.length === 1 && !children[0])) {
            return null;
        }
        return (
            <div class={style.container}>
                <div class={[style.status, style[type]].join(' ')}>
                    {children}
                </div>
                {dismissable && (
                    <Button className={style.close} onClick={this.dismiss}>
                        ✕
                    </Button>
                )}
            </div>
        );
    }
}
