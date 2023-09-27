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

import { useTranslation } from 'react-i18next';
import { Dialog, DialogButtons } from '../dialog/dialog';
import { Button } from '../forms';
import { SimpleMarkup } from '../../utils/markup';
import { ReactNode } from 'react';

type TCallback = (response: boolean) => void;
type TProps = { message?: string, showDialog: boolean; callback: TCallback, onClose: (e?: Event) => void; childrenBefore?: ReactNode; childrenAfter?: ReactNode;}

const Confirm = ({ message, showDialog, callback, onClose, childrenBefore, childrenAfter }: TProps) => {
  const { t } = useTranslation();

  const handleConfirm = () => {
    onClose();
    callback(true);
  };

  const handleCancel = () => {
    onClose();
    callback(false);
  };

  return (
    <Dialog title={t('dialog.confirmTitle')} open={showDialog} onClose={handleCancel}>
      {childrenBefore && childrenBefore}
      <div className="columnsContainer half">
        <div className="columns">
          <div className="column">
            {
              message ? message.split('\n').map((line, i) => (
                <p
                  key={i}
                  className={i === 0 ? 'first' : ''}>
                  <SimpleMarkup tagName="span" markup={line} />
                </p>
              )) : null
            }
          </div>
        </div>
      </div>
      {childrenAfter && childrenAfter}

      <DialogButtons>
        <Button primary onClick={handleConfirm}>
          {t('dialog.confirm')}
        </Button>
        <Button secondary onClick={handleCancel}>
          {t('dialog.cancel')}
        </Button>
      </DialogButtons>
    </Dialog>
  );
};

export { Confirm };