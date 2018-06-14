import { h, Component } from 'preact';
import { apiWebsocket } from '../../utils/websocket';
import { apiGet } from '../../utils/request';

export default class UpdatingComponent extends Component {
    componentDidMount() {
        for (const entry of this.map) {
            apiGet(entry.url).then(object => {
                const state = new Object();
                state[entry.key] = object;
                this.setState(state);
            });
        }
        this.unsubscribe = apiWebsocket(({ subject, action, object }) => {
            for (const entry of this.map) {
                if (subject === entry.url) {
                    const state = new Object();
                    state[entry.key] = object;
                    this.setState(state);
                }
            }
        });
    }

    componentWillUnmount() {
        this.unsubscribe();
    }
}
