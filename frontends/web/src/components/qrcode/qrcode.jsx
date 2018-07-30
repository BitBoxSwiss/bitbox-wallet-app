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

import { h, Component } from 'preact';
import { apiGet } from '../../utils/request';

const emptyImage = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

export default class QRCode extends Component {
    state = {
        src: emptyImage
    }

    componentDidMount() {
        this.update(this.props.data);
    }

    componentWillReceiveProps({ data }) {
        if (this.props.data !== data) {
            this.update(data);
        }
    }

    update = (data) => {
        this.setState({ src: emptyImage });
        apiGet('qr?data=' + encodeURIComponent(data)).then(src => this.setState({ src }));
    }

    render({}, { src }) {
        return (
            <img
                width={256}
                height={256}
                src={src} />
        );
    }
}
