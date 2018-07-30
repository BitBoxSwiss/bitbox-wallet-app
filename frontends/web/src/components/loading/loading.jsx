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
import { apiGet } from '../../utils/request';
import { equal } from '../../utils/equal';

// Loads API endpoints into the state.
export default class LoadingComponent extends Component {
    // Subclasses should implement the following method:
    // getStateMap() {
    //     return { key: 'endpoint/' + this.props.value };
    // }

    // Maps the entries of the given state map as returned by getStateMap() into the state.
    mapState(stateMap) {
        Object.entries(stateMap).forEach(
            ([key, url]) => apiGet(url).then(object => this.setState({ [key]: object }))
        );
    }

    mapStateIfChanged() {
        if (this.getStateMap) {
            const newStateMap = this.getStateMap();
            if (!equal(newStateMap, this.prevStateMap)) {
                this.prevStateMap = newStateMap;
                this.mapState(newStateMap);
            }
        } else {
            console.warn(this.constructor.name + ' extends LoadingComponent but does not implement getStateMap().');
        }
    }

    componentDidMount() {
        this.mapStateIfChanged();
    }

    componentDidUpdate() {
        this.mapStateIfChanged();
    }

}
