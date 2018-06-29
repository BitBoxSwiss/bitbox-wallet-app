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
