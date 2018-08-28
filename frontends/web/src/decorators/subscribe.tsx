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

import { h, Component, RenderableProps, ComponentConstructor, FunctionalComponent } from 'preact';
import { EndpointsObject, EndpointsFunction } from './endpoints';
import { apiSubscribe, Event } from '../utils/event';
import { apiGet } from '../utils/request';
import { equal } from '../utils/equal';
import load from './load';

/**
 * Loads API endpoints into the props of the component that uses this decorator and updates them on events.
 * 
 * @param endpointsObjectOrFunction - The endpoints that should be loaded to their respective property name.
 * @param renderOnlyOnceLoaded - Whether the decorated component shall only be rendered once all endpoints are loaded.
 * @return A function that returns the higher-order component that loads and updates the endpoints into the props of the decorated component.
 * 
 * How to use this decorator on a component class?
 * ```
 * @subscribe<ExampleProps>({ propertyName: 'path/to/endpoint' })
 * export default class Example extends Component<ExampleProps, ExampleState> {
 *     render({ propertyName }: RenderableProps<ExampleProps>): JSX.Element {
 *         return <div>{propertyName}</div>;
 *     }
 * }
 * ```
 * 
 * How to use this decorator on a functional component?
 * Unfortunately, the decorator cannot be applied directly.
 * ```
 * function Example({ propertyName }: RenderableProps<ExampleProps>): JSX.Element {
 *     return <div>{propertyName}</div>
 * }
 * 
 * export default subscribe<ExampleProps>({ propertyName: 'path/to/endpoint' })(Example);
 * ```
 */
export default function subscribe<Props, State>(
    endpointsObjectOrFunction: EndpointsObject<Props> | EndpointsFunction<Props>,
    renderOnlyOnceLoaded: boolean = true,
) {
    return function decorator(
        WrappedComponent:  ComponentConstructor<Props, State> | FunctionalComponent<Props>,
    ) {
        return class Subscribe extends Component<Props, any> {
            private determineEndpoints(): EndpointsObject<Props> {
                if (typeof endpointsObjectOrFunction === 'function') {
                    return endpointsObjectOrFunction(this.props);
                }
                return endpointsObjectOrFunction;
            }

            private endpoints: EndpointsObject<Props>;

            private subscriptions: { [key: string]: () => void } = {};

            private unsubscribeEndpoint(key: string) {
                this.subscriptions[key]();
                delete this.subscriptions[key];
            }

            private unsubscribeIfSubscribed(key: string) {
                if (this.subscriptions[key]) {
                    this.unsubscribeEndpoint(key);
                }
            }

            private subscribeEndpoint(key: string, endpoint: string): void {
                this.unsubscribeIfSubscribed(key);
                this.subscriptions[key] = apiSubscribe(endpoint, (event: Event) => {
                    switch (event.action) {
                    case 'replace':
                        this.setState({ [key]: event.object });
                        break;
                    case 'prepend':
                        this.setState(state => ({ [key]: [event.object, ...state[key]] }));
                        break;
                    case 'append':
                        this.setState(state => ({ [key]: [...state[key], event.object] }));
                        break;
                    case 'remove':
                        this.setState(state => ({ [key]: state[key].filter(item => !equal(item, event.object)) }));
                        break;
                    case 'reload':
                        apiGet(event.subject).then(object => this.setState({ [key]: object }));
                        break;
                    }
                });
            }

            private subscribeEndpoints(): void {
                const oldEndpoints = this.endpoints;
                const newEndpoints = this.determineEndpoints();
                // Update the endpoints that were different or undefined before.
                for (const key of Object.keys(newEndpoints)) {
                    if (oldEndpoints == null || newEndpoints[key] !== oldEndpoints[key]) {
                        this.subscribeEndpoint(key, newEndpoints[key]);
                    }
                }
                if (oldEndpoints != null) {
                    // Remove endpoints that no longer exist from the state.
                    for (const key of Object.keys(oldEndpoints)) {
                        if (newEndpoints[key] === undefined) {
                            this.unsubscribeIfSubscribed(key);
                            this.setState({ [key]: undefined });
                        }
                    }
                }
                this.endpoints = newEndpoints;
            }

            public componentDidMount(): void {
                this.subscribeEndpoints();
            }

            public componentDidUpdate(): void {
                this.subscribeEndpoints();
            }

            public componentWillUnmount() {
                for (const key of Object.keys(this.subscriptions)) {
                    this.unsubscribeEndpoint(key);
                }
            }

            private readonly LoadWrappedComponent = load(endpointsObjectOrFunction, renderOnlyOnceLoaded)(WrappedComponent);

            public render(props: RenderableProps<Props>, state: any): JSX.Element {
                return <this.LoadWrappedComponent {...state} {...props} />;
            }
        }
    }
}
