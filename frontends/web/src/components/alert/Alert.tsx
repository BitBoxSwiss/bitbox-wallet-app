/**
 * Copyright 2018 Shift Devices AG
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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MultilineMarkup } from '../../utils/markup';
import { View, ViewButtons, ViewHeader } from '../view/view';
import { Button } from '../forms';

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

  alertUser = (newMessage: string, options: AlertUserOptions = {}) => {
    const nextMessage = active ? `${message}; \n ${newMessage}` : newMessage;
    const {
      asDialog = true,
    } = options;
    callback = options.callback;
    setActive(true);
    setAsDialog(asDialog);
    setMessage(nextMessage);
  };

  const handleClose = () => {
    if (callback) {
      callback();
    }
    setActive(false);
  };

  return (active && message) ? (
    <form onSubmit={() => setActive(false)}>
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
