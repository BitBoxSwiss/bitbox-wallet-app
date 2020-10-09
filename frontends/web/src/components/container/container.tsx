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

import { cloneElement, h, JSX, RenderableProps } from 'preact';
import { Router } from 'preact-router';

interface Props {
    children: JSX.Element[];
    toggleSidebar: () => void;
    onChange: () => void;
}

const Container = ({
    children,
    toggleSidebar,
    onChange,
}: RenderableProps<Props>) => {
    return (
        <Router onChange={onChange}>
            { children.map(child => cloneElement(child, { toggleSidebar })) }
        </Router>
    );
};

export { Container };
