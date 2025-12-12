// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TAuthEventObject, authenticate, subscribeAuth } from '@/api/backend';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button } from '@/components/forms';
import style from './authrequired.module.css';
import { UseDisableBackButton } from '@/hooks/backbutton';

export const AuthRequired = () => {
  const { t } = useTranslation();
  // If authRequired is true, the user needs to authenticate before accessing the app.
  const [authRequired, setAuthRequired] = useState(false);
  // authenticating is true while we wait for the result of an authentication.
  const [authenticating, setAuthenticating] = useState(false);
  // missing auth means that there is no authentication method setup on the device.
  const [missingAuth, setMissingAuth] = useState(false);
  const authForced = useRef(false);

  // newAuthentication fires a new authentication flow.
  const newAuthentication = () => {
    setMissingAuth(false);
    setAuthenticating(true);
    authenticate(authForced.current);
  };

  // dismissAuth dismisses the AuthRequired component.
  const dismissAuth = () => {
    setAuthRequired(false);
    authForced.current = false;
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
      case 'auth-result':
        setAuthenticating(false);
        switch (data.result) {
        case 'authres-err':
          break;
        case 'authres-cancel':
          if (authForced.current) {
            // a canceled forced auth can be dismissed and won't be repeated, as
            // it means that the user aborted the authentication flow needed to enable
            // the screen lock.
            dismissAuth();
          }
          break;
        case 'authres-ok':
          dismissAuth();
          break;
        case 'authres-missing':
          setMissingAuth(true);
          break;
        }
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
      <UseDisableBackButton/>
      <View
        fullscreen
        textCenter
        verticallyCentered
        withBottomBar>
        { !authenticating && (
          <>
            <ViewHeader withAppLogo title={
              t(missingAuth ? 'auth.missing' : 'auth.title')
            } />
            <ViewContent children={undefined} minHeight="0"/>
            <ViewButtons>
              <Button
                autoFocus
                primary
                onClick={newAuthentication}>
                {t('auth.authButton')}
              </Button>
              {authForced.current && (
                <Button
                  autoFocus
                  primary
                  onClick={dismissAuth}>
                  {t('auth.dismissButton')}
                </Button>
              )}
            </ViewButtons>
          </>
        )}
      </View>
    </div>
  );
};
