// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TEntryProp } from '../../components/guide/entry';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';

export const LightningGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide>
      <Entry key="privateKey" entry={t('guide.lightning.privateKey', { returnObjects: true }) as unknown as TEntryProp} />
      <Entry key="securedByBitBox" entry={t('guide.lightning.securedByBitBox', { returnObjects: true }) as unknown as TEntryProp} />
      <Entry key="multipleDevices" entry={t('guide.lightning.multipleDevices', { returnObjects: true }) as unknown as TEntryProp} />
      <Entry key="multipleWallets" entry={t('guide.lightning.multipleWallets', { returnObjects: true }) as unknown as TEntryProp} />
      <Entry key="providers" entry={t('guide.lightning.providers', { returnObjects: true }) as unknown as TEntryProp} />
    </Guide>
  );
};

export const LightningSendGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.lightningSend')}>
      <Entry key="guide.lightning.send.payment" entry={{
        text: t('guide.lightning.send.payment.text'),
        title: t('guide.lightning.send.payment.title'),
      }} />
      <Entry key="guide.lightning.send.invoiceAndAddress" entry={{
        text: t('guide.lightning.send.invoiceAndAddress.text'),
        title: t('guide.lightning.send.invoiceAndAddress.title'),
      }} />
      <Entry key="guide.lightning.send.fee" entry={{
        text: t('guide.lightning.send.fee.text'),
        title: t('guide.lightning.send.fee.title'),
      }} />
      <Entry key="guide.lightning.send.cancel" entry={{
        text: t('guide.lightning.send.cancel.text'),
        title: t('guide.lightning.send.cancel.title'),
      }} />
    </Guide>
  );
};

export const LightningReceiveGuide = () => {
  const { t } = useTranslation();
  return (
    <Guide title={t('guide.guideTitle.lightningReceive')}>
      <Entry key="guide.lightning.receive.payment" entry={{
        text: t('guide.lightning.receive.payment.text'),
        title: t('guide.lightning.receive.payment.title'),
      }} />
      <Entry key="guide.lightning.receive.invoiceOrAddress" entry={{
        text: t('guide.lightning.receive.invoiceOrAddress.text'),
        title: t('guide.lightning.receive.invoiceOrAddress.title'),
      }} />
      <Entry key="guide.lightning.receive.reuseAddress" entry={{
        text: t('guide.lightning.receive.reuseAddress.text'),
        title: t('guide.lightning.receive.reuseAddress.title'),
      }} />
      <Entry key="guide.lightning.receive.fee" entry={{
        text: t('guide.lightning.receive.fee.text'),
        title: t('guide.lightning.receive.fee.title'),
      }} />
    </Guide>
  );
};
