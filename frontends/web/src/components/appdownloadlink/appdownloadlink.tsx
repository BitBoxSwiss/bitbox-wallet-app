/**
 * Copyright 2023 Shift Crypto AG
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

import { useTranslation } from 'react-i18next';
import { i18n } from '@/i18n/i18n';
import { URL_CONSTANTS } from '@/utils/url_constants';
import { Button } from '@/components/forms';
import { A } from '@/components/anchor/anchor';

export const downloadLinkByLanguage = () => {
  switch (i18n.resolvedLanguage) {
  case 'de':
    return URL_CONSTANTS.DOWNLOAD_LINK_DE;
  case 'es':
    return URL_CONSTANTS.DOWNLOAD_LINK_ES;
  default:
    return URL_CONSTANTS.DOWNLOAD_LINK_GLOBAL;
  }
};

export const AppDownloadLink = ({ ...props }) => {
  const { t } = useTranslation();
  return (
    <A href={downloadLinkByLanguage()} {...props}>
      {t('button.download')}
    </A>
  );
};

export const AppDownloadButton = ({ ...props }) => {
  const { t } = useTranslation();

  // button as child of an anchor element would be invalid HTML, but our A component does not use <a> element. However Button should probably accept href directly so that <A> isn't needed.
  return (
    <A href={downloadLinkByLanguage()} {...props}>
      <Button primary>
        {t('button.download')}
      </Button>
    </A>
  );
};
