// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { exportBalanceStatement } from '@/api/backend';
import { alertUser } from '@/components/alert/Alert';
import { Dialog, DialogButtons, DialogScrollContent } from '@/components/dialog/dialog';
import { Button, Checkbox, Input, Label } from '@/components/forms';
import { Logo } from '@/components/icon/logo';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import styles from './export-balance-statement-setting.module.css';

type TProps = {
  accounts: accountApi.TAccount[];
};

const formatDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultSnapshotDate = (): string => {
  return `${new Date().getFullYear() - 1}-12-31`;
};

export const ExportBalanceStatementSetting = ({ accounts }: TProps) => {
  const { t } = useTranslation();
  const activeAccounts = useMemo(() => accounts.filter(account => account.active), [accounts]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snapshotDate, setSnapshotDate] = useState(getDefaultSnapshotDate());
  const [selectedAccountCodes, setSelectedAccountCodes] = useState<accountApi.AccountCode[]>([]);

  // The accounts list can change while the dialog is open (e.g. a keystore
  // disconnects), so only ever act on the selected codes that are still active.
  const selectedActiveCodes = useMemo(
    () => selectedAccountCodes.filter(code => activeAccounts.some(account => account.code === code)),
    [selectedAccountCodes, activeAccounts],
  );
  const allSelected = activeAccounts.length > 0
    && activeAccounts.every(({ code }) => selectedAccountCodes.includes(code));
  const today = formatDateInput(new Date());
  const dateValid = snapshotDate.length > 0 && snapshotDate <= today;

  const openDialog = () => {
    setSelectedAccountCodes(activeAccounts.map(({ code }) => code));
    setSnapshotDate(getDefaultSnapshotDate());
    setOpen(true);
  };

  const onToggleAccount = (accountCode: accountApi.AccountCode, selected: boolean) => {
    if (selected) {
      setSelectedAccountCodes(prev => prev.includes(accountCode) ? prev : [...prev, accountCode]);
      return;
    }
    setSelectedAccountCodes(prev => prev.filter(code => code !== accountCode));
  };

  const onToggleAll = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedAccountCodes(
      event.target.checked ? activeAccounts.map(({ code }) => code) : []
    );
  };

  const onGenerate = async () => {
    try {
      setSubmitting(true);
      const result = await exportBalanceStatement(selectedActiveCodes, snapshotDate);
      if (result.success) {
        setOpen(false);
      } else if (!result.aborted && result.message) {
        alertUser(result.message);
      }
    } catch (error) {
      console.error('Failed to export balance statement', error);
      alertUser(t('genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SettingsItem
        disabled={activeAccounts.length === 0}
        settingName={t('settings.balanceStatement.export.title')}
        secondaryText={t('settings.balanceStatement.export.description')}
        onClick={openDialog}
      />
      <Dialog
        medium
        open={open}
        onClose={() => setOpen(false)}
        title={t('settings.balanceStatement.export.dialog.title')}>
        <DialogScrollContent>
          <p className={styles.description}>
            {t('settings.balanceStatement.export.dialog.description')}
          </p>
          <Input
            id="statement-snapshot-date"
            label={t('settings.balanceStatement.export.dialog.dateLabel')}
            max={today}
            onChange={(event) => setSnapshotDate(event.target.value)}
            type="date"
            value={snapshotDate}
          />
          <div className={styles.accountsHeader}>
            <Label className={styles.accountsLabel}>
              {t('settings.balanceStatement.export.dialog.accountsLabel')}
            </Label>
            <Checkbox
              checked={allSelected}
              id="statement-select-all"
              label={t('settings.balanceStatement.export.dialog.selectAll')}
              onChange={onToggleAll}
            />
          </div>
          <div className={styles.accountsList}>
            {activeAccounts.length === 0 ? (
              <p className={styles.description}>
                {t('settings.balanceStatement.export.dialog.noAccounts')}
              </p>
            ) : activeAccounts.map((account) => (
              <div className={styles.accountItem} key={account.code}>
                <Checkbox
                  checked={selectedAccountCodes.includes(account.code)}
                  id={`statement-account-${account.code}`}
                  onChange={(event) => onToggleAccount(account.code, event.target.checked)}>
                  <span className={styles.accountLabel}>
                    <Logo
                      active
                      alt={account.coinUnit}
                      className={styles.coinLogo}
                      coinCode={account.coinCode}
                    />
                    <span className={styles.accountName}>
                      {account.name}
                    </span>
                    <span className={styles.accountUnit}>
                      {account.coinUnit}
                    </span>
                  </span>
                </Checkbox>
              </div>
            ))}
          </div>
        </DialogScrollContent>
        <DialogButtons>
          <Button
            disabled={selectedActiveCodes.length === 0 || !dateValid || submitting}
            onClick={onGenerate}
            primary>
            {t('settings.balanceStatement.export.dialog.generate')}
          </Button>
          <Button onClick={() => setOpen(false)} secondary>
            {t('dialog.cancel')}
          </Button>
        </DialogButtons>
      </Dialog>
    </>
  );
};
