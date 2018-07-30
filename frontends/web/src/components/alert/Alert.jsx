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
                    {context.split('\n').map(line => <p key={line}>{line}</p>)}
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
