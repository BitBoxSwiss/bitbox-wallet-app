import { h, Component } from 'preact';
import { apiWebsocket } from '../../utils/websocket';
import { apiGet } from '../../utils/request';
import { equal } from '../../utils/equal';

export default class UpdatingComponent extends Component {
    componentDidMount() {
        for (const entry of this.map) {
            apiGet(entry.url).then(object => {
                this.setState({ [entry.key]: object });
            });
        }
        this.unsubscribe = apiWebsocket(({ subject, action, object }) => {
            for (const entry of this.map) {
                if (subject === entry.url) {
                    switch (action) {
                    case 'replace':
                        this.setState({ [entry.key]: object });
                        break;
                    case 'prepend':
                        this.setState(state => ({ [entry.key]: [object, ...state[entry.key]] }));
                        break;
                    case 'append':
                        this.setState(state => ({ [entry.key]: [...state[entry.key], object] }));
                        break;
                    case 'remove':
                        this.setState(state => ({ [entry.key]: state[entry.key].filter(item => !equal(item, object)) }));
                        break;
                    }
                }
            }
        });
    }

    componentWillUnmount() {
        this.unsubscribe();
    }
}
