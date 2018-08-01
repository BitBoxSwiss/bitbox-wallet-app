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
import { Button } from '../forms';
import style from './Confirm.css';

export default class Confirm extends Component {
    state = {
        message: '',
        active: false,
    }

    componentDidMount() {
        window.confirm = this.confirmOverride;
    }

    confirmOverride = (message, callback) => {
        this.setState({
            message: message,
            active: true,
        });
        this.callback = callback;
    }

    respond = input => {
        this.callback(input);
        this.setState({
            active: false,
            message: '',
        }, () => {
          this.callback = null;
        });
    }

    render({}, {
      message,
      callback,
      active,
    }) {
        if (!active) return;
        return (
            <div class={style.overlay}>
                <div class={style.confirmWindow}>
                    <p>{message}</p>
                    <div class={style.buttons}>
                        <Button secondary onClick={() => this.respond(false)}>Cancel</Button>
                        <Button primary onClick={() => this.respond(true)}>Confirm</Button>
                    </div>
                </div>
            </div>
        );
    }
}
