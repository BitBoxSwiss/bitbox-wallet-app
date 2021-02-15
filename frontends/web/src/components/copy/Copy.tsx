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

import { Component, h, RenderableProps } from 'preact';
import CheckIcon from '../../assets/icons/check.svg';
import CopyIcon from '../../assets/icons/copy.svg';
import { translate, TranslateProps } from '../../decorators/translate';
import * as style from './Copy.css';

interface CopyableInputProps {
    value: string;
    className?: string;
    disabled?: boolean;
    flexibleHeight?: boolean;
}

type Props = CopyableInputProps & TranslateProps;

interface State {
    success: boolean;
}

class CopyableInput extends Component<Props, State> {
    public readonly state: State = {
        success: false,
    }

    private textArea: HTMLTextAreaElement | null = null;

    public componentDidMount() {
        this.setHeight();
    }

    public componentDidUpdate() {
        this.setHeight();
    }

    private setHeight() {
        const textarea = this.textArea;
        if (textarea) {
            const fontSize = window.getComputedStyle(textarea, null).getPropertyValue('font-size');
            const units = Number(fontSize.replace('px', '')) + 2;
            textarea.setAttribute('rows', '1');
            textarea.setAttribute('rows', String(Math.round((textarea.scrollHeight / units) - 2)));
        }
    }

    private onFocus = (e: FocusEvent) => {
        const textarea = e.target as HTMLTextAreaElement;
        if (textarea) {
            textarea.focus();
        }
    }

    private copy = () => {
        this.textArea?.select();
        if (document.execCommand('copy')) {
            this.setState({ success: true }, () => {
                setTimeout(() => this.setState({ success: false }), 1500);
            });
        }
    }

    public render(
        { t, value, className, disabled, flexibleHeight }: RenderableProps<Props>,
        { success }: State,
    ) {
        const copyButton = disabled ? null : (
            <button
                onClick={this.copy}
                className={[style.button, success && style.success, 'ignore'].join(' ')}
                title={t('button.copy')}>
                <img src={success ? CheckIcon : CopyIcon} />
            </button>
        );
        return (
            <div class={['flex flex-row flex-start flex-items-start', style.container, className ? className : ''].join(' ')}>
                <textarea
                    disabled={disabled}
                    readOnly
                    onFocus={this.onFocus}
                    value={value}
                    ref={textarea => this.textArea = textarea}
                    rows={1}
                    className={[style.inputField, flexibleHeight && style.flexibleHeight].join(' ')} />
                {copyButton}
            </div>
        );
    }
}

const TranslatedCopyableInput = translate<CopyableInputProps>()(CopyableInput);
export { TranslatedCopyableInput as CopyableInput };
