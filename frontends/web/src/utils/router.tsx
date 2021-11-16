/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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
import { Link, route } from 'preact-router';

type redirectDigest = (url:string) => string;
let redirect: redirectDigest;

export const setRedirect = (fn: redirectDigest) => {
    redirect = fn;
};

export const localRoute = (url: string, navigate?: boolean) => {
    route(redirect ? redirect(url) : url, navigate);
};

export const LocalLink = (props) => <Link {...props} href={(redirect !== undefined && props.href) ? redirect(props.href) : props.href} />;