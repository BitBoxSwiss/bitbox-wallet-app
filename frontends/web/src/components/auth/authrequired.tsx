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

import { View } from '../view/view';
import style from './authrequired.module.css';
import { useEffect, useRef, useState } from 'react';
import { TAuthEventObject, authenticate, subscribeAuth } from '../../api/backend';

export const AuthRequired = () => {
  const [authRequired, setAuthRequired] = useState(false);
  const authForced = useRef(false);

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
            authenticate(authForced.current);
          }
          return true;
        });
        break;
      case 'auth-err':
        authenticate(authForced.current);
        break;
      case 'auth-canceled':
        if (authForced.current) {
          // forced auth can be dismissed and won't be repeated, as it is
          // tied to a specific UI event (e.g. enabling the auth toggle in
          // the advanced settings.
          setAuthRequired(false);
          authForced.current = false;
        } else {
          authenticate(authForced.current);
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
    authenticate();

    return unsubscribe;
  }, []);

  if (!authRequired) {
    return null;
  }

  return (
    <div className={style.auth}>
      <View
        fullscreen
        verticallyCentered
        width="100%"
        withBottomBar>
      </View>
    </div>
  );
};
