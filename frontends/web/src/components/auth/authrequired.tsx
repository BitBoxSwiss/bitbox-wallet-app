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

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TAuthEventObject, authenticate, subscribeAuth } from '@/api/backend';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms';
import style from './authrequired.module.css';

export const AuthRequired = () => {
  const { t } = useTranslation();
  const [authRequired, setAuthRequired] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const authForced = useRef(false);

  const newAuthentication = () => {
    setAuthenticating(true);
    authenticate(authForced.current);
  };

  useEffect(() => {
    const unsubscribe = subscribeAuth((data: TAuthEventObject) => {
      switch (data.typ) {
      case 'auth-forced':
        authForced.current = true;
        break;
      case 'auth-required':
        // It is a bit strange to call authenticate inside `setAuthRequired`,
        // but doing so we avoid declaring `authRequired` as a useEffect's
        // dependency, which would cause it to unsubscribe/subscribe every
        // time the state changes.
        setAuthRequired((prevAuthRequired) => {
          if (!prevAuthRequired) {
            newAuthentication();
          }
          return true;
        });
        break;
      case 'auth-err':
        setAuthenticating(false);
        break;
      case 'auth-canceled':
        if (authForced.current) {
          // forced auth can be dismissed and won't be repeated, as it is
          // tied to a specific UI event (e.g. enabling the auth toggle in
          // the advanced settings.
          setAuthRequired(false);
          authForced.current = false;
        } else {
          setAuthenticating(false);
        }
        break;
      case 'auth-ok':
        setAuthRequired(false);
        authForced.current = false;
      }
    });

    // Perform initial authentication. If the auth config is disabled,
    // the backend will immediately send an auth-ok back.
    setAuthRequired(true);
    newAuthentication();

    return unsubscribe;
  }, []);

  if (!authRequired) {
    return null;
  }

  return (
    <div className={style.auth}>
      <View
        fullscreen
        textCenter
        verticallyCentered
        withBottomBar>
        <ViewHeader small title={t('auth.title')} />
        <ViewContent children={undefined} minHeight="0" />
        <ViewButtons>
          <Button
            autoFocus
            primary
            hidden={authForced.current}
            disabled={authenticating}
            onClick={newAuthentication}>
            {t('auth.authButton')}
          </Button>
        </ViewButtons>
      </View>
    </div>
  );
};
