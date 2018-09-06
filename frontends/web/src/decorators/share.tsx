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
import { getDisplayName } from '../utils/component';

/**
 * This class allows all instances of a component to share a common state.
 */
export class Store<State> {
    private components: Component[] = [];

    /**
     * This method should only be called by the Share HOC below.
     */
    subscribe(component: Component): void {
        this.components.push(component);
    }

    /**
     * This method should only be called by the Share HOC below.
     */
    unsubscribe(component: Component): void {
        const index = this.components.indexOf(component);
        this.components.splice(index, 1);
    }

    private updateComponents(): void {
        for (const component of this.components) {
            component.forceUpdate();
        }
    }

    /**
     * Creates a new store with the given initial state.
     */
    public constructor(public readonly state: Readonly<State>) {}

    /**
     * Sets the state of this store and updates the subscribed components.
     * Please note that you are allowed to pass a partial state just as in React.
     */
    public setState(partialState: Partial<State>): void {
        // @ts-ignore
        Object.assign(this.state, partialState);
        this.updateComponents();
    }
}

/**
 * Shares a store with its state among all instances of the wrapped component.
 * 
 * @param store - The store whose state is shared among all instances of the wrapped component.
 * @return A function that returns the higher-order component that shares the state of the store as props.
 * 
 * Example:
 * ```
 * interface SharedProps {
 *     value: number;
 * }
 * 
 * const store = new Store<SharedProps>({ value: 1 });
 * 
 * function incrementValue() {
 *     store.setState({ value: store.state.value + 1});
 * }
 * 
 * class InternalCounter extends Component<SharedProps> {
 *     public render({ value }: RenderableProps<SharedProps>): JSX.Element {
 *         return <div onClick={incrementValue}>Value: { value }</div>;
 *     }
 * }
 * 
 * export const Counter = share(store)(InternalCounter);
 * ```
 */
export function share<SharedProps, ProvidedProps = {}>(
    store: Store<SharedProps>,
) {
    return function decorator(
        WrappedComponent: ComponentConstructor<SharedProps & ProvidedProps> | FunctionalComponent<SharedProps & ProvidedProps>,
    ) {
        return class Share extends Component<ProvidedProps & Partial<SharedProps>> {
            static displayName = `Share(${getDisplayName(WrappedComponent)})`;

            public componentDidMount(): void {
                store.subscribe(this);
            }

            public componentWillUnmount(): void {
                store.unsubscribe(this);
            }

            public render(props: RenderableProps<ProvidedProps & Partial<SharedProps>>): JSX.Element {
                return <WrappedComponent {...store.state} {...props as any} />; // This order allows the parent component to override the shared store with properties.
            }
        };
    };
}
