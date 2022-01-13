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

import { Component } from 'react';
import { ObjectButNotFunction } from '../utils/types';

/**
 * This class allows all instances of a component to share a common state.
 */
export class Store<State extends ObjectButNotFunction> {
  private components: Component[] = [];

  /**
     * This method should only be called by the Share HOC.
     */
  public subscribe(component: Component): void {
    this.components.push(component);
  }

  /**
     * This method should only be called by the Share HOC.
     */
  public unsubscribe(component: Component): void {
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
  /* eslint no-useless-constructor: "off" */
  public constructor(public readonly state: Readonly<State>) {}

  /**
     * Sets the state of this store and updates the subscribed components.
     * Please note that you are allowed to pass a partial state just as in React.
     */
  public setState(partialState: Partial<State>): void {
    Object.assign(this.state, partialState);
    this.updateComponents();
  }
}
