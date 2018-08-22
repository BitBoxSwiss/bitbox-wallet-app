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
import { apiGet } from '../utils/request';

// Stores whether to log the time needed for individual API calls.
const logPerformance = false;

// The counter is used to measure the time needed for individual API calls.
let logCounter = 0;

/**
 * Loads API endpoints into the props of the component that uses this decorator.
 * 
 * @param endpointsObjectOrFunction - The endpoints that should be loaded to their respective property name.
 * @param renderOnlyOnceLoaded - Whether the decorated component shall only be rendered once all endpoints are loaded.
 * @return A function that returns the higher-order component that loads the endpoints into the props of the decorated component.
 * 
 * How to use this decorator on a component class?
 * ```
 * @loading<ExampleProps>({ propertyName: 'path/to/endpoint' })
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
 * const LoadingExample = loading<ExampleProps>({ propertyName: 'path/to/endpoint' })(Example);
 * export default LoadingExample;
 * ```
 * 
 * Please note that you cannot export the constant directly as a default
 * because `export default const a = 1, b = 2;` does not make sense
 * (see https://github.com/Microsoft/TypeScript/issues/18737).
 */
export default function loading<Props, State = {}>(
    endpointsObjectOrFunction: EndpointsObject<Props> | EndpointsFunction<Props>,
    renderOnlyOnceLoaded: boolean = true,
) {
    return function decorator(
        WrappedComponent:  ComponentConstructor<Props, State> | FunctionalComponent<Props>,
    ) {
        return class LoadingComponent extends Component<Props, any> {
            private determineEndpoints(): EndpointsObject<Props> {
                if (typeof endpointsObjectOrFunction === "function") {
                    return endpointsObjectOrFunction(this.props);
                }
                return endpointsObjectOrFunction;
            }

            private loadEndpoint(key: string, endpoint: string): void {
                logCounter += 1;
                const timerID = endpoint + ' ' + logCounter;
                if (logPerformance) { console.time(timerID); }
                apiGet(endpoint).then(object => {
                    this.setState({ [key]: object });
                    if (logPerformance) { console.timeEnd(timerID); }
                });
            }

            private endpoints: EndpointsObject<Props>;

            private loadEndpoints(): void {
                const oldEndpoints = this.endpoints;
                const newEndpoints = this.determineEndpoints();
                // Load the endpoints that were different or undefined before.
                for (const key of Object.keys(newEndpoints)) {
                    if (oldEndpoints == null || newEndpoints[key] !== oldEndpoints[key]) {
                        this.loadEndpoint(key, newEndpoints[key]);
                    }
                }
                if (oldEndpoints != null) {
                    // Remove endpoints that no longer exist from the state.
                    for (const key of Object.keys(oldEndpoints)) {
                        if (newEndpoints[key] === undefined) {
                            this.setState({ [key]: undefined });
                        }
                    }
                }
                this.endpoints = newEndpoints;
            }

            public componentDidMount(): void {
                this.loadEndpoints();
            }

            public componentDidUpdate(): void {
                this.loadEndpoints();
            }

            private allEndpointsLoaded(): boolean {
                if (this.endpoints == null) { return false; }
                for (const key of Object.keys(this.endpoints)) {
                    if (this.state[key] === undefined) {
                        return false;
                    }
                }
                return true;
            }
            
            public render(props: RenderableProps<Props>, state: any): JSX.Element | null {
                if (renderOnlyOnceLoaded && !this.allEndpointsLoaded()) { return null; }
                return <WrappedComponent {...state} {...props} />; // This order allows the updating decorator (and others) to override the loaded endpoints with properties.
            }
        }
    }
}
