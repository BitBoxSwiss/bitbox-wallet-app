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
import { apiSubscribe, Event } from '../utils/event';
import { apiGet } from '../utils/request';
import { KeysOf, ObjectButNotFunction } from '../utils/types';
import { Endpoint, EndpointsFunction, EndpointsObject } from './endpoint';
import { load } from './load';

/**
 * Loads API endpoints into the props of the component that uses this decorator and updates them on events.
 *
 * @param endpointsObjectOrFunction - The endpoints that should be loaded to their respective property name.
 * @param renderOnlyOnceLoaded - Whether the decorated component shall only be rendered once all endpoints are loaded. Only applies if `subscribeWithoutloading` is false. Use false only if all loaded props are optional!
 * @param subscribeWithoutLoading - Whether the endpoints shall only be subscribed without loading them first. Use true only if all loaded props are optional!
 * @return A function that returns the higher-order component that loads and updates the endpoints into the props of the decorated component.
 */
export function subscribe<LoadedProps extends ObjectButNotFunction, ProvidedProps extends ObjectButNotFunction = {}>(
  endpointsObjectOrFunction: EndpointsObject<LoadedProps> | EndpointsFunction<ProvidedProps, LoadedProps>,
  renderOnlyOnceLoaded: boolean = true,
  subscribeWithoutLoading: boolean = false,
) {
  return function decorator(
    WrappedComponent: ComponentType<LoadedProps & ProvidedProps>,
  ) {
    return class Subscribe extends Component<ProvidedProps & Partial<LoadedProps>, LoadedProps> {
      public static displayName = `Subscribe(${getDisplayName(WrappedComponent as any)})`;

      private determineEndpoints(): EndpointsObject<LoadedProps> {
        if (typeof endpointsObjectOrFunction === 'function') {
          return endpointsObjectOrFunction(this.props);
        }
        return endpointsObjectOrFunction;
      }

      private subscriptions: { [Key in keyof LoadedProps]?: () => void } = {};

      private unsubscribeEndpoint(key: keyof LoadedProps) {
        const subscription = this.subscriptions[key];
        if (subscription !== undefined) {
          subscription();
          delete this.subscriptions[key];
          if (subscribeWithoutLoading || !renderOnlyOnceLoaded) {
            // There is no loading on component update, so we reset it to the default value.
            this.setState({ [key]: undefined as any } as Pick<LoadedProps, keyof LoadedProps>);
          }
        }
      }

      private subscribeEndpoint(key: keyof LoadedProps, endpoint: Endpoint): void {
        this.unsubscribeEndpoint(key);
        this.subscriptions[key] = apiSubscribe(endpoint, (event: Event) => {
          switch (event.action) {
          case 'replace':
            this.setState({ [key]: event.object } as Pick<LoadedProps, keyof LoadedProps>);
            break;
          case 'reload':
            apiGet(event.subject).then(object => this.setState({ [key]: object } as Pick<LoadedProps, keyof LoadedProps>));
            break;
          }
        });
      }

      private endpoints?: EndpointsObject<LoadedProps>;

      private subscribeEndpoints(): void {
        const oldEndpoints = this.endpoints;
        const newEndpoints = this.determineEndpoints();
        // Update the endpoints that were different or undefined before.
        for (const key of Object.keys(newEndpoints) as KeysOf<LoadedProps>) {
          if (oldEndpoints === undefined || newEndpoints[key] !== oldEndpoints[key]) {
            this.subscribeEndpoint(key, newEndpoints[key]);
          }
        }
        if (oldEndpoints !== undefined) {
          // Remove endpoints that no longer exist from the state.
          for (const key of Object.keys(oldEndpoints) as KeysOf<LoadedProps>) {
            if (newEndpoints[key] === undefined) {
              this.unsubscribeEndpoint(key);
              this.setState({ [key]: undefined as any } as Pick<LoadedProps, keyof LoadedProps>);
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
        for (const key of Object.keys(this.subscriptions) as KeysOf<LoadedProps>) {
          this.unsubscribeEndpoint(key);
        }
      }

      private readonly component = subscribeWithoutLoading ? WrappedComponent : load(endpointsObjectOrFunction, renderOnlyOnceLoaded)(WrappedComponent);

      public render(): JSX.Element {
        const props = this.props;
        const state = this.state;
        const Component = this.component;
        return <Component {...state} {...props} />;
      }
    };
  };
}
