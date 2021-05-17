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

import { h } from 'preact';

// SimpleMarkup renders `foo <strong>bar</strong> baz` safely as `foo <strong>bar</strong> baz`. Anything else is rendered as sanitized text.
// Only <strong> is supported to keep it simple.
export default function SimpleMarkup({ tagName, markup, ...props }) {
    if (typeof markup !== 'string') {
        return null;
    }
    let simpleMarkupChunks = /^(.*)<strong>(.*)<\/strong>(.*)$/.exec(markup);
    if (simpleMarkupChunks === null || simpleMarkupChunks.length !== 4) {
        return h(tagName, props, markup);
    }
    return h(tagName, props, simpleMarkupChunks[1], h('strong', null, simpleMarkupChunks[2]), simpleMarkupChunks[3]);

}
