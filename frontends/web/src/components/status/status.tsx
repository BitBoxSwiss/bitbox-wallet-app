/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component} from 'react';
import { apiGet, apiPost } from '../../utils/request';
import { CloseXWhite } from '../icon';
import style from './status.module.css';

interface State {
    show: boolean;
}

interface StatusProps {
    hidden?: boolean;
    type?: 'success' | 'warning' | 'info';
    // used as keyName in the config if dismissing the status should be persisted, so it is not
    // shown again. Use an empty string if it should be dismissable without storing it in the
    // config, so the status will be shown again the next time.
    dismissable?: string;
    className?: string;
}

type Props = StatusProps;

export default class Status extends Component<Props, State> {
    public readonly state: State = {
        show: true,
    };

    public componentDidMount() {
        this.checkConfig();
    }

    public componentDidUpdate(prevProps: Props) {
        if (this.props.dismissable !== prevProps.dismissable) {
            this.checkConfig();
        }
    }

    private checkConfig() {
        if (this.props.dismissable) {
            apiGet('config').then(({ frontend }) => {
                if (!this.props.dismissable) {
                    return;
                }
                this.setState({
                    show: !frontend ? true : !frontend[this.props.dismissable],
                });
            });
        }
    }

    private dismiss = () => {
        apiGet('config').then(config => {
            if (!this.props.dismissable) {
                return;
            }
            const newConf = {
                ...config,
                frontend: {
                    ...config.frontend,
                    [this.props.dismissable]: true,
                },
            };
            apiPost('config', newConf);
        });
        this.setState({
            show: false,
        });
    }

    public render() {
        const {
            children,
            className,
            dismissable,
            hidden,
            type = 'warning',
        } = this.props;
        const { show } = this.state;
        if (hidden || !show) {
            return null;
        }
        return (
            <div className={[style.container, style[type], className ? className : '', dismissable ? style.withCloseBtn : ''].join(' ')}>
                <div className={style.status}>
                    {children}
                    <button
                        hidden={!dismissable}
                        className={`${style.close} ${style[`close-${type}`]}`}
                        onClick={this.dismiss}>
                        <CloseXWhite />
                    </button>
                </div>
            </div>
        );
    }
}
