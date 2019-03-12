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
import { apiGet } from '../../utils/request';

const emptyImage = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

interface Props {
    data?: string;
    size?: number;
}

interface State {
    src: string;
}

class QRCode extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            src: emptyImage,
        };
    }

    public static defaultProps = {
        size: 256,
    };

    public componentDidMount() {
        this.update(this.props.data);
    }

    public componentWillReceiveProps({ data }) {
        if (this.props.data !== data) {
            this.update(data);
        }
    }

    private update = (data: string | undefined) => {
        this.setState({ src: emptyImage });
        if (data !== undefined) {
            apiGet('qr?data=' + encodeURIComponent(data)).then(src => this.setState({ src }));
        }
    }

    public render(
        { size }: RenderableProps<Props>,
        { src }: State,
    ) {
        return (
            <img
                width={size}
                height={size}
                src={src}
            />
        );
    }
}

export { QRCode };
