/**
 * Copyright 2019 Shift Devices AG
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

import { Component, h, RenderableProps } from 'preact';
import { translate, TranslateProps } from '../../decorators/translate';
import * as style from './help.css';

interface HelpProps {
    type: string;
    text: string;
    position: string;
}

interface State {
    show: boolean;
}

type Props = HelpProps & TranslateProps;

class Help extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            show: false,
        };
    }

    private showText = (event: Event) => {
        event.preventDefault();
        this.setState({ show: true }, () => {
            this.registerClick();
        });
    }

    private registerClick = () => {
        document.addEventListener('click', this.handleClick);
    }

    private unregisterClick = () => {
        document.removeEventListener('click', this.handleClick);
    }

    private handleClick = (e: Event) => {
        const classList = (e.target as HTMLElement).classList;
        if (!classList.contains(style.box) && !classList.contains(style.toggler)) {
            e.preventDefault();
            this.setState({ show: false }, () => {
                this.unregisterClick();
            });
        }
    }

    public render(
        { position, text, type }: RenderableProps<Props>,
        { show }: State,
    ) {
        return type === 'click' ? (
            <a className={style.container}>
                <span className={style.toggler} onClick={this.showText}>?</span>
                <div className={[style.box, style[position], show ? style.show : style.hide].join(' ')}>{text}</div>
            </a>
        ) : (
            <a className={style.container}>
                <span className={[style.toggler, style.hover].join(' ')}>?</span>
                <div className={[style.box, style[position]].join(' ')}>{text}</div>
            </a>
        );
    }
}

const TranslatedHelp = translate<HelpProps>()(Help);
export { TranslatedHelp as Help };
