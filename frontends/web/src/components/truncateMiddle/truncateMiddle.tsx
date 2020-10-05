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

interface TruncateMiddleType {
    text: string;
    letterCount?: number;
}

class TruncateMiddle extends Component<TruncateMiddleType> {

    private truncate = (str: string) => {
        const count = this.props.letterCount || 37;
        return `${str.substring(0, count / 2)}.....${str.substring(str.length - 15, str.length)}`;
    }

    public render(
        { text }: RenderableProps<TruncateMiddleType>,
    ) {
        return (
            <span title={text}>{this.truncate(text)}</span>
        );
    }
}

export { TruncateMiddle };
