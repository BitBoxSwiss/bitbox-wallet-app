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

import { translate, TranslateProps } from '../decorators/translate';
import { AppDownloadLink } from './appdownloadlink/appdownloadlink';

function AppUpgradeRequired({ t }: TranslateProps) {
  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer">
          <div className="content narrow isVerticallyCentered">
            <div className="box large">
              <p className="m-top-none">{t('device.appUpradeRequired')}</p>
              <div className="buttons m-top-half">
                <AppDownloadLink className="text-medium text-blue" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const HOC = translate()(AppUpgradeRequired);
export { HOC as AppUpgradeRequired };
