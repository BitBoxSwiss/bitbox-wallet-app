// SPDX-License-Identifier: Apache-2.0

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
  case 'it':
    return URL_CONSTANTS.DOWNLOAD_LINK_IT;
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
