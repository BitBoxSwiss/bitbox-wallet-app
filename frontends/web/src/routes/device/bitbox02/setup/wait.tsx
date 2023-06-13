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
import { View, ViewContent, ViewHeader } from '../../../../components/view/view';
import { PointToBitBox02 } from '../../../../components/icon';

type Props = {
  title: string;
  text?: string;
}

export const Wait = ({ title, text }: Props) => {
  const { t } = useTranslation();
  return (
    <View
      fullscreen
      width="720px"
      verticallyCentered
      textCenter>
      <ViewHeader title={title}>
        <p>{text ? text : t('bitbox02Interact.followInstructions')}</p>
      </ViewHeader>
      <ViewContent>
        <PointToBitBox02 />
      </ViewContent>
    </View>
  );
};
