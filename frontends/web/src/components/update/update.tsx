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
import { translate, TranslateProp } from '../../decorators/translate';
import A from '../anchor/anchor';
import Status from '../status/status';

/**
 * Describes the file that is loaded from 'https://shiftcrypto.ch/updates/desktop.json'.
 */
interface File {
    current: string;
    version: string;
    description: string;
}

interface LoadedProps {
    file: File | null;
}

type Props = LoadedProps & TranslateProp;

function Update({ file, t }: RenderableProps<Props>): JSX.Element | null {
    return file && (
        <Status dismissable keyName={`update-${file.version}`} type="info">
            {t('app.upgrade', {
                current: file.current,
                version: file.version,
            })}
            {file.description}
            {' '}
            <A href="https://shiftcrypto.ch/start">
                {t('button.download')}
            </A>
        </Status>
    );
}

const HOC = translate()(load<LoadedProps, TranslateProp>({ file: 'update' })(Update));

export { HOC as Update };
