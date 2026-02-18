// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VersionInfo } from '@/api/bitbox02';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import { Column, ColumnButtons, Grid } from '@/components/layout';
import { Button, Label } from '@/components/forms';
import { Toggle } from '@/components/toggle/toggle';
import { InfoBlue } from '@/components/icon';
import style from './choose.module.css';

export type TWalletSetupChoices = 'create-wallet' | 'restore-sdcard' | 'restore-mnemonic';

export type TWalletCreateOptions = {
  withMnemonic: boolean;
  with12Words: boolean;
};

type Props = {
  onSelectSetup: (
    type: TWalletSetupChoices,
    options?: TWalletCreateOptions,
  ) => void;
  versionInfo: VersionInfo;
};

export const SetupOptions = ({
  onSelectSetup,
  versionInfo,
}: Props) => {
  const { t } = useTranslation();
  const [advanced, setAdvanced] = useState(false);
  const [withMnemonic, setWithMnemonic] = useState(false);
  const [with12Words, setWith12Words] = useState(false);

  if (advanced) {
    const {
      canBackupWithRecoveryWords, // supported with firmware v9.13.0
      canCreate12Words, // supported with firmware v9.6.0
    } = versionInfo;
    return (
      <View
        fullscreen
        textCenter
        verticallyCentered
        withBottomBar
        width="1100px">
        <ViewHeader small title={t('seed.create')} />
        <ViewContent fullWidth>
          <Grid col="1" textAlign="start">
            <Column asCard>
              <h3 className="title">
                {t('bitbox02Wizard.advanced.title')}
              </h3>
              <div>
                <div className={style.toggle}>
                  <Label
                    htmlFor="with-mnemonic"
                    className={style.toggleLabel}
                    style={{
                      ...(!canBackupWithRecoveryWords && { color: 'var(--color-disabled)' }),
                    }}>
                    <strong>
                      {t('bitbox02Wizard.advanced.skipSDCardLabel')}
                    </strong>
                    {' '}
                    { !canBackupWithRecoveryWords && (
                      <span style={{ color: 'var(--color-warning)' }}>
                        <br />
                        ({t('bitbox02Wizard.advanced.outOfDate')})
                      </span>
                    )}
                  </Label>
                  <Toggle
                    checked={withMnemonic}
                    disabled={!canBackupWithRecoveryWords}
                    id="with-mnemonic"
                    onChange={() => setWithMnemonic(!withMnemonic)} />
                </div>
                <p className="m-top-quarter m-bottom-default">
                  <small>
                    {t('bitbox02Wizard.advanced.skipSDCardText')}
                  </small>
                </p>
              </div>

              <div>
                <div className={style.toggle}>
                  <Label
                    htmlFor="with-12words"
                    className={style.toggleLabel}
                    style={{
                      ...(!canCreate12Words && { color: 'var(--color-disabled)' }),
                    }}>
                    <strong>
                      {t('bitbox02Wizard.advanced.seed12WordLabel')}
                    </strong>
                    {' '}
                    { !canCreate12Words && (
                      <span style={{ color: 'var(--color-warning)' }}>
                        <br />
                        ({t('bitbox02Wizard.advanced.outOfDate')})
                      </span>
                    )}
                  </Label>
                  <Toggle
                    checked={with12Words}
                    disabled={!canCreate12Words}
                    id="with-12words"
                    onChange={() => setWith12Words(!with12Words)} />
                </div>
                <p className="m-top-quarter m-bottom-default">
                  <small>
                    {t('bitbox02Wizard.advanced.seed12WordText')}
                  </small>
                </p>
                <p className="m-top-quarter m-bottom-default">
                  <small>
                    <InfoBlue className={style.textIcon} />
                    {t('bitbox02Wizard.advanced.seed12WordInfo')}
                  </small>
                </p>
              </div>
              <ColumnButtons inline>
                <Button
                  onClick={() => onSelectSetup('create-wallet', {
                    withMnemonic,
                    with12Words,
                  })}
                  primary>
                  {t('seed.create')}
                </Button>
                <Button
                  onClick={() => {
                    setWithMnemonic(false);
                    setWith12Words(false);
                    setAdvanced(false);
                  }}
                  secondary>
                  {t('button.back')}
                </Button>
              </ColumnButtons>
            </Column>
          </Grid>
        </ViewContent>
      </View>
    );
  }

  return (
    <View
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar
      width="1100px">
      <ViewHeader small title={t('bitbox02Wizard.stepUninitialized.title')}>
        <p>
          <InfoBlue className={style.textIcon} />
          {t('bitbox02Wizard.initialize.tip')}
        </p>
      </ViewHeader>
      <ViewContent fullWidth>
        <Grid>
          <Column asCard className={style.cardHeight}>
            <h3 className="title">
              {t('button.create')}
            </h3>
            <p>
              {t('bitbox02Wizard.stepUninitialized.create')}
            </p>
            <ColumnButtons>
              <Button
                primary
                onClick={() => onSelectSetup('create-wallet', {
                  withMnemonic: false,
                  with12Words: false,
                })}>
                {t('seed.create')}
              </Button>
              <Button
                onClick={() => setAdvanced(true)}
                transparent>
                <small>
                  {t('bitbox02Wizard.advanced.button')}
                </small>
              </Button>
            </ColumnButtons>
          </Column>
          <Column asCard className={style.cardHeight}>
            <h3 className="title">
              {t('button.restore')}
            </h3>
            <p>
              {t('bitbox02Wizard.stepUninitialized.restore')}
            </p>
            <ColumnButtons>
              <Button
                onClick={() => onSelectSetup('restore-sdcard')}
                secondary>
                {t('bitbox02Wizard.stepUninitialized.restoreMicroSD')}
              </Button>
              <Button
                onClick={() => onSelectSetup('restore-mnemonic')}
                secondary>
                {t('bitbox02Wizard.stepUninitialized.restoreMnemonic')}
              </Button>
            </ColumnButtons>
          </Column>
        </Grid>
      </ViewContent>
    </View>
  );
};
