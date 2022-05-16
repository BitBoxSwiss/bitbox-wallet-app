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

import { Component, ComponentType } from 'react';
import { getDisplayName } from '../utils/component';
import { ObjectButNotFunction } from '../utils/types';
import { Store } from './store';

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
 * class Counter extends Component<SharedProps> {
 *     public render({ value }: PropsWithChildren<SharedProps>): JSX.Element {
 *         return <div onClick={incrementValue}>Value: { value }</div>;
 *     }
 * }
 *
 * const HOC = share(store)(Counter);
 *
 * export { HOC as Counter };
 * ```
 */
export function share<SharedProps extends ObjectButNotFunction, ProvidedProps extends ObjectButNotFunction = {}>(
  store: Store<SharedProps>,
) {
  return function decorator(
    WrappedComponent: ComponentType<SharedProps & ProvidedProps>,
  ) {
    return class Share extends Component<ProvidedProps & Partial<SharedProps>> {
      public static displayName = `Share(${getDisplayName(WrappedComponent as any)})`;

      public componentDidMount(): void {
        store.subscribe(this);
      }

      public componentWillUnmount(): void {
        store.unsubscribe(this);
      }

      public render(): JSX.Element {
        const props = this.props;
        return <WrappedComponent {...store.state} {...props as any} />; // This order allows the parent component to override the shared store with properties.
      }
    };
  };
}
