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
import style from './InlineMessage.css';

export default class InlineMessage extends Component {
	deactivate = () => {
	    this.props.onEnd();
	}

	render({
	    type,
	    message,
	    align,
	}, {}) {
	    return (
	        <div class={[style.inlineMessage, style[type], align ? style[align] : ''].join(' ')}>
	            {message}
	            <div class={style.close} onClick={this.deactivate}>✕</div>
	        </div>
	    );
	}
}
