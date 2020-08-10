/**
 * Copyright 2018 Shift Devices AG
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

import { Component, ComponentChild, h, RenderableProps } from 'preact';
import { apiGet, apiPost } from '../../utils/request';
import * as style from './status.css';

interface State {
    show: boolean;
}

interface StatusProps {
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

    public componentDidUpdate(prevProps) {
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

    public render(
        {
            children,
            type = 'warning',
            dismissable,
            className,
        }: RenderableProps<Props>,
        {
            show,
        }: State) {
        const childrenList = children as ComponentChild[];
        if (!show || (childrenList && childrenList.length === 1 && !childrenList[0])) {
            return null;
        }
        return (
            <div className={[style.container, style[type], className ? className : ''].join(' ')}>
                <div className={style.status}>
                    {children}
                    {
                        dismissable !== undefined && (
                            <a
                                href="#"
                                className={`${style.close} ${style[`close-${type}`]}`}
                                onClick={this.dismiss} >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </a>
                        )
                    }
                </div>
            </div>
        );
    }
}
