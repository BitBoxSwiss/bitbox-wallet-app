// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { PointToBitBox02 } from '@/components/icon';
import { UseDisableBackButton } from '@/hooks/backbutton';

type Props = {
  title: string;
  text?: string;
};

export const Wait = ({ title, text }: Props) => {
  const { t } = useTranslation();
  return (
    <View
      fullscreen
      width="720px"
      verticallyCentered
      textCenter>
      <UseDisableBackButton />
      <ViewHeader title={title}>
        <p>{text ? text : t('bitbox02Interact.followInstructions')}</p>
      </ViewHeader>
      <ViewContent>
        <PointToBitBox02 />
      </ViewContent>
    </View>
  );
};
