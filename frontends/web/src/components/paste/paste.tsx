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
import PasteIcon from '../../assets/icons/clipboard.svg';
import * as style from './paste.css';

interface Props {
    target: HTMLInputElement;
}

class Paste extends Component<Props> {
    private paste = (e: Event) => {
      e.preventDefault();
      this.props.target.focus();
      // @ts-ignore
      navigator.clipboard.readText().then(text => {
        this.props.target.value = text;
      });
      this.setState({ pasted: true }, () => {
          setTimeout(() => {
              this.setState({ pasted: false });
          }, 1500);
      });
    }

    public render({}: RenderableProps<Props>) {
        return (
            <span className={style.button} onClick={this.paste}>
                <img src={PasteIcon} />
                Paste
            </span>
        );
    }
}

export { Paste };
