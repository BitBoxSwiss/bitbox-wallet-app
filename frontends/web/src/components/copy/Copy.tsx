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

import { Component, h, RenderableProps } from 'preact';
import CheckIcon from '../../assets/icons/check.svg';
import CopyIcon from '../../assets/icons/copy.svg';
import { translate, TranslateProps } from '../../decorators/translate';
import * as style from './Copy.css';

interface CopyableInputProps {
    value: string;
    className?: string;
    disabled?: boolean;
}

type Props = CopyableInputProps & TranslateProps;

interface State {
    success: boolean;
}

class CopyableInput extends Component<Props, State> {
    private inputField!: HTMLInputElement;

    constructor(props: Props) {
        super(props);
        this.state = {
            success: false,
        };
    }

    public componentDidMount() {
        this.setHeight();
    }

    public componentDidUpdate() {
        this.setHeight();
    }

    private setHeight() {
        const textarea = this.inputField;
        const fontSize = window.getComputedStyle(textarea, null).getPropertyValue('font-size');
        const units = Number(fontSize.replace('px', '')) + 2;
        textarea.setAttribute('rows', '1');
        textarea.setAttribute('rows', String(Math.round((textarea.scrollHeight / units) - 2)));
    }

    private setRef = (input: HTMLInputElement) => {
        this.inputField = input;
    }

    private onFocus = (e: Event) => {
        const input = e.target as HTMLInputElement;
        input.focus();
    }

    private copy = () => {
        this.inputField.select();
        if (document.execCommand('copy')) {
            this.setState({ success: true }, () => {
                setTimeout(() => this.setState({ success: false }), 1500);
            });
        }
    }

    public render({ t, value, className, disabled }: RenderableProps<Props>, { success }: State) {
        return (
            <div class={['flex flex-row flex-start flex-items-start', style.container, className ? className : ''].join(' ')}>
                <textarea
                    disabled={disabled}
                    readOnly
                    onFocus={this.onFocus}
                    value={value}
                    ref={this.setRef}
                    rows={1}
                    className={style.inputField} />
                <button
                    disabled={disabled}
                    onClick={this.copy}
                    class={[style.button, success ? style.success : ''].join(' ')}
                    title={t('button.copy')}>
                    <img src={success ? CheckIcon : CopyIcon} />
                </button>
            </div>
        );
    }
}

const TranslatedCopyableInput = translate<CopyableInputProps>()(CopyableInput);

export { TranslatedCopyableInput as CopyableInput };
