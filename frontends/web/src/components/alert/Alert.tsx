// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MultilineMarkup } from '@/utils/markup';
import { UseBackButton } from '@/hooks/backbutton';
import { View, ViewButtons, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms';

/**
 * Function to activate global alert component with a message
 * @deprecated better is to show an inline error instead of using this global component
 * @param message the string to show
 * @param callback callback function called after user confirm
 * @param asDialog option to opt-out of rendinging as dialog
 */

type AlertUserOptions = {
  callback?: () => void;
  asDialog?: boolean;
};

let alertUser: (message: string, options?: AlertUserOptions) => void;
let callback: AlertUserOptions['callback'];

const Alert = () => {
  const [active, setActive] = useState(false);
  const [asDialog, setAsDialog] = useState(true);
  const [message, setMessage] = useState<string>();
  const { t } = useTranslation();

  alertUser = (message: string, options: AlertUserOptions = {}) => {
    const {
      asDialog = true,
    } = options;
    callback = options.callback;
    setActive(true);
    setAsDialog(asDialog);
    setMessage(message);
  };

  const handleClose = () => {
    if (callback) {
      callback();
    }
    setActive(false);
  };

  return (active && message) ? (
    <form onSubmit={() => setActive(false)}>
      <UseBackButton handler={() => {
        setActive(false); return false;
      }} />
      <View
        key="alert-overlay"
        dialog={asDialog}
        fullscreen
        textCenter={!asDialog}
        verticallyCentered>
        <ViewHeader title={<MultilineMarkup tagName="span" markup={message} />} />
        <ViewButtons>
          <Button
            autoFocus
            primary
            onClick={handleClose}>
            {t('button.ok')}
          </Button>
        </ViewButtons>
      </View>
    </form>
  ) : null;
};

export { Alert, alertUser };
