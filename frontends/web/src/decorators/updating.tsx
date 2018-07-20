import { h, Component, RenderableProps, ComponentConstructor, FunctionalComponent } from 'preact';
import { Endpoints, EndpointsFunction } from './endpoints';
import { apiWebsocket } from '../utils/websocket';
import { apiGet } from '../utils/request';
import { equal } from '../utils/equal';
import loading from './loading';

/**
 * Loads API endpoints into the props of the component that uses this decorator and updates them on events.
 * 
 * @param endpointsObjectOrFunction - The endpoints that should be loaded to their respective property name.
 * @param renderOnlyOnceLoaded - Whether the decorated component shall only be rendered once all endpoints are loaded.
 * @return A function that returns the higher-order component that loads and updates the endpoints into the props of the decorated component.
 * 
 * How to use this decorator on a component class?
 * ```
 * @updating({ propertyName: 'path/to/endpoint' })
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
 * export const UpdatingExample = updating({ propertyName: 'path/to/endpoint' })(Example);
 * ```
 */
export default function updating<Props, State>(
    endpointsObjectOrFunction: Endpoints | EndpointsFunction<Props>,
    renderOnlyOnceLoaded: boolean = true,
) {
    return function decorator(
        WrappedComponent:  ComponentConstructor<Props, State> | FunctionalComponent<Props>,
    ) {
        return class UpdatingComponent extends Component<Props, any> {
            private determineEndpoints(): Endpoints {
                if (typeof endpointsObjectOrFunction === "function") {
                    return endpointsObjectOrFunction(this.props as any); // How to avoid this cast?
                }
                return endpointsObjectOrFunction;
            }

            private unsubscribe: () => void;

            private unsubscribeIfSubscribed() {
                if (this.unsubscribe) {
                    this.unsubscribe();
                    delete this.unsubscribe;
                }
            }

            private endpoints: Endpoints;

            private updateEndpoints(): void {
                this.unsubscribeIfSubscribed();
                this.unsubscribe = apiWebsocket(({ subject, action, object }) => {
                    if (!subject || !action) {
                        return;
                    }
                    for (const key of Object.keys(this.endpoints)) {
                        if (subject === this.endpoints[key]) {
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
                                apiGet(this.endpoints[key]).then(object => this.setState({ [key]: object }));
                                break;
                            }
                        }
                    };
                });        
            }

            private updateEndpointsIfChanged(): void {
                const newEndpoints = this.determineEndpoints();
                if (!equal(newEndpoints, this.endpoints)) {
                    this.endpoints = newEndpoints;
                    this.updateEndpoints();
                }
            }

            public componentDidMount(): void {
                this.updateEndpointsIfChanged();
            }

            public componentDidUpdate(): void {
                this.updateEndpointsIfChanged();
            }

            public componentWillUnmount() {
                this.unsubscribeIfSubscribed();
            }        

            public render(props: RenderableProps<Props>, state: any): JSX.Element {
                const LoadingWrappedComponent = loading(endpointsObjectOrFunction, renderOnlyOnceLoaded)(WrappedComponent);
                return <LoadingWrappedComponent {...state} {...props} />;
            }
        }
    }
}
