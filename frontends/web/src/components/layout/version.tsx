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

import { h, RenderableProps } from 'preact';
import { load } from '../../decorators/load';
import { translate, TranslateProps } from '../../decorators/translate';

interface VersionProps {
    version: string;
}

type Props = VersionProps & TranslateProps;

function Version({ t, version }: RenderableProps<Props>) {
    return <p>{t('footer.appVersion')} {version}</p>;
}

const HOC = translate()(load<VersionProps, TranslateProps>({ version: 'version' })(Version));
export { HOC as Version };
