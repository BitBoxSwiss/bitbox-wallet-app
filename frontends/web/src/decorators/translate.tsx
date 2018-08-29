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
import { translate as originalTranslate } from 'react-i18next';

// Instead of 'https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-i18next'.

/**
 * This interface describes the interpolation values of 'i18next'.
 */
export interface InterpolationValues {
    readonly [key: string]: string;
}

/**
 * This type describes the translate method of 'react-i18next'.
 */
export type Translate = (i18nKey: string, values?: InterpolationValues) => string;

/**
 * This interface makes it easier to declare properties with intersection types.
 */
export interface TranslateProp {
    t: Translate;
}

/**
 * This function provides type safety for the 'react-i18next' translate decorator.
 */
export function translate<ProvidedProps = {}>(
    WrappedComponent:  ComponentConstructor<TranslateProp & ProvidedProps> | FunctionalComponent<TranslateProp & ProvidedProps>,
) {
    return originalTranslate(WrappedComponent) as ComponentConstructor<ProvidedProps> | FunctionalComponent<ProvidedProps>;
}
