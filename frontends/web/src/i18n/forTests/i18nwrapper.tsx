/**
 * Copyright 2022 Shift Crypto AG
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

import { I18nextProvider } from 'react-i18next';
import i18n from './i18nfortests';

type TProps = {
  children: React.ReactNode
}

const I18NWrapper = ({ children }: TProps) => {
  return <I18nextProvider i18n={i18n}>
	  {children}
  </I18nextProvider>;
};

export default I18NWrapper;
