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

// Allows to import GIF.
declare module '*.gif';

// Allows to import JSON.
declare module '*.json';

// Allows to import PNG.
declare module '*.png';

// Allows to import SVG.
declare module '*.svg';

// Extends preact's HTML attributes.
declare namespace JSX { // tslint:disable-line:no-namespace
    interface HTMLAttributes {
        align?: 'left' | 'right' | 'center';
        allow?: 'payment';
        autocorrect?: 'on' | 'off';
        spellcheck?: boolean;
    }
}
