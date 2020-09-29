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

import { RenderableProps } from 'preact';
import { ObjectButNotFunction } from '../utils/types';

/**
 * Describes the path of an API endpoint (available with the GET method).
 */
export type Endpoint = string;

/**
 * Describes which endpoints should be loaded to which property names.
 *
 * Example: `{ propertyName: 'path/to/endpoint' }`
 */
export type EndpointsObject<LoadedProps extends ObjectButNotFunction> = {
    /* eslint no-unused-vars: "off" */
    readonly [Key in keyof LoadedProps]: Endpoint;
};

/**
 * Allows to derive the endpoints based on existing properties.
 *
 * Example: `props => 'subject/' + props.id + '/attribute`
 */
export type EndpointsFunction<ProvidedProps extends ObjectButNotFunction, LoadedProps extends ObjectButNotFunction> = (props: RenderableProps<ProvidedProps>) => EndpointsObject<LoadedProps>;
