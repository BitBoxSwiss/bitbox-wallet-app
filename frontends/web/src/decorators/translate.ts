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

import { ComponentFactory } from 'preact';
// @ts-ignore ('frontends/web/node_modules/react-i18next/dist/commonjs/index.js' implicitly has an 'any' type)
import { translate as originalTranslate } from 'react-i18next';
import { ObjectButNotFunction } from '../utils/types';

// The types in 'https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-i18next'
// use the types of React instead of Preact, thus we define our own types in this file.

/**
 * This interface describes the interpolation values of 'i18next'.
 */
interface InterpolationValues {
    readonly [key: string]: string;
}

/**
 * This interface describes the default value to return if no translation was found.
 */
interface DefaultValue {
    defaultValue: any;
}

/**
 * This interface models the various options of the translate function.
 */
type TranslateOptions = InterpolationValues | DefaultValue | string;

/**
 * This type describes the translate function of 'react-i18next'.
 * The return type is intentionally 'any' because we also allow arrays and objects besides strings.
 */
export type Translate = (i18nKey: string, values?: TranslateOptions) => any;

/**
 * This interface makes it easier to declare properties with intersection types.
 */
export interface TranslateProps {
    t: Translate;
}

interface HOCOptions {
    withRef?: boolean;
}

type Namespaces = string | string[];

type NamespacesFunction<ProvidedProps extends ObjectButNotFunction> = (props: ProvidedProps) => Namespaces;

type NamespaceOptions<ProvidedProps extends ObjectButNotFunction> = Namespaces | NamespacesFunction<ProvidedProps>;

/**
 * This function provides type safety for the 'react-i18next' translate decorator.
 */
export function translate<ProvidedProps extends ObjectButNotFunction = {}>(
    namespace?: NamespaceOptions<ProvidedProps>,
    options?: HOCOptions,
) {
    return function decorator(
        WrappedComponent: ComponentFactory<TranslateProps & ProvidedProps>,
    ): ComponentFactory<ProvidedProps> {
        return originalTranslate(namespace, options)(WrappedComponent);
    };
}
