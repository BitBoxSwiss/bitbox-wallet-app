import { h, Component, RenderableProps, ComponentConstructor, FunctionalComponent } from 'preact';
import { Endpoints, EndpointsFunction } from './endpoints';
import { apiGet } from '../utils/request';
import { equal } from '../utils/equal';

/**
 * Loads API endpoints into the props of the component that uses this decorator.
 * 
 * @param endpoints - The endpoints that should be loaded to their respective property name.
 * @param renderOnlyOnceLoaded - Whether the decorated component shall only be rendered once all endpoints are loaded.
 * @return A function that returns the higher-order component that loads the endpoints into the props of the decorated component.
 * 
 * How to use this decorator on a component class?
 * ```
 * @Loading({ propertyName: 'path/to/endpoint' })
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
 * export const LoadingExample = Loading({ propertyName: 'path/to/endpoint' })(Example);
 * ```
 */
export default function Loading<Props, State>(
    endpoints: Endpoints | EndpointsFunction<Props>,
    renderOnlyOnceLoaded: boolean = true,
) {
    return function <Props, State>(
        WrappedComponent:  ComponentConstructor<Props, State> | FunctionalComponent<Props>,
    ) {
        return class LoadingComponent extends Component<Props, any> {
            determineEndpoints(): Endpoints {
                if (typeof endpoints === "function") {
                    return endpoints(this.props as any); // How to avoid this cast?
                }
                return endpoints;
            }

            loadEndpoints(): void {
                for (const key of Object.keys(endpoints)) {
                    apiGet(endpoints[key]).then(object => this.setState({ [key]: object }));
                }
            }

            private loadedEndpoints: Endpoints;

            loadEndpointsIfChanged(): void {
                const newEndpoints = this.determineEndpoints();
                if (!equal(newEndpoints, this.loadedEndpoints)) {
                    this.loadedEndpoints = newEndpoints;
                    this.loadEndpoints();
                }
            }

            componentDidMount(): void {
                this.loadEndpointsIfChanged();
            }

            componentDidUpdate(): void {
                this.loadEndpointsIfChanged();
            }

            allEndpointsLoaded(): boolean {
                if (!this.loadedEndpoints) { return false; }
                for (const key of Object.keys(endpoints)) {
                    if (!this.loadedEndpoints[key]) {
                        return false;
                    }
                }
                return true;
            }
            
            render(): JSX.Element {
                if (renderOnlyOnceLoaded && !this.allEndpointsLoaded()) { return null; }
                return <WrappedComponent {...this.props} {...this.state} />;
            }
        }
    }
}
