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

import { apiWebsocket } from '../../utils/websocket';
import { apiGet } from '../../utils/request';
import { equal } from '../../utils/equal';
import LoadingComponent from '../loading/loading';

// Loads API endpoints into the state and updates them on events.
export default class UpdatingComponent extends LoadingComponent {
    // Subclasses should implement the following method:
    // getStateMap() {
    //     return { key: 'endpoint/' + this.props.value };
    // }

    unsubscribeIfSubscribed() {
        if (this.unsubscribe) {
            this.unsubscribe();
            delete this.unsubscribe;
        }
    }

    // Overwrites mapState in LoadingComponent.
    mapState(stateMap) {
        super.mapState(stateMap);
        this.unsubscribeIfSubscribed();
        this.unsubscribe = apiWebsocket(({ subject, action, object }) => {
            if (!subject || !action) {
                return;
            }
            Object.entries(stateMap).forEach(
                ([key, url]) => {
                    if (subject === url) {
                        switch (action) {
                        case 'replace':
                            this.setState({ [key]: object });
                            break;
                        case 'prepend':
                            this.setState(state => ({ [key]: [object, ...state[key]] }));
                            break;
                        case 'append':
                            this.setState(state => ({ [key]: [...state[key], object] }));
                            break;
                        case 'remove':
                            this.setState(state => ({ [key]: state[key].filter(item => !equal(item, object)) }));
                            break;
                        case 'reload':
                            apiGet(url).then(object => this.setState({ [key]: object }));
                            break;
                        }
                    }
                }
            );
        });
    }

    componentWillUnmount() {
        this.unsubscribeIfSubscribed();
    }
}
