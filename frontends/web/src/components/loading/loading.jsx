import { Component } from 'preact';
import { apiGet } from '../../utils/request';
import { equal } from '../../utils/equal';

// Loads API endpoints into the state.
export default class LoadingComponent extends Component {
    // Subclasses should implement the following function:
    // getStateMap() {
    //     return { key: 'url/' + this.props.value };
    // }

    // Maps the entries of the given state map as returned by getStateMap() into the state.
    mapState(stateMap) {
        Object.entries(stateMap).forEach(
            ([key, url]) => apiGet(url).then(object => this.setState({ [key]: object }))
        );
    }

    componentDidUpdate(prevProps) {
        if (this.getStateMap && !equal(this.props, prevProps)) {
            this.mapState(this.getStateMap());
        }
    }
}
