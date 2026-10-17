// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '../settingsItem/settingsItem';
import { Dialog, DialogScrollContent } from '@/components/dialog/dialog';
import { Badge } from '@/components/badge/badge';
import { A } from '@/components/anchor/anchor';
import styles from './licenses.module.css';

type TPackage = {
  name: string;
  version: string;
  license: string | null;
  repository: string | null;
  licenseText: string | null;
};

const Package = (pkg: TPackage) => {
  return (
    <details
      key={`${pkg.name}@${pkg.version}`}
      className={styles.package}
    >
      <summary className={styles.summary}>
        <strong>{pkg.name}</strong>
        {' '}
        <Badge>
          v{pkg.version}
        </Badge>
        {' '}
        <Badge type="info">
          {pkg.license ?? 'Unknown license'}
        </Badge>
      </summary>

      <div className={styles.licenseContainer}>

        {pkg.licenseText && (
          <section>
            <pre className={styles.license}>
              {pkg.licenseText}
            </pre>
          </section>
        )}

        {!pkg.licenseText && (
          <p>License text not available.</p>
        )}

        {pkg.repository && (
          <p>
            <A href={pkg.repository}>
              {pkg.repository}
            </A>
          </p>
        )}
      </div>
    </details>
  );
};

export const Licenses = () => {
  const { t } = useTranslation();
  const [showDialog, setShowDialog] = useState(false);
  const [licenses, setLicenses] = useState<TPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${import.meta.env.BASE_URL}licenses-npm.json`, {
      signal: controller.signal,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load licenses: ${response.status}`);
        }
        return response.json() as Promise<TPackage[]>;
      })
      .then(setLicenses)
      .catch(error => {
        if (controller.signal.aborted) {
          return;
        }

        const err = (
          error instanceof Error
            ? error
            : new Error(String(error))
        );

        console.error(err);
        setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <>
      <SettingsItem
        settingName={t('licenses.title')}
        secondaryText={t('licenses.description')}
        onClick={() => setShowDialog(true)}
      />

      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        title={t('licenses.title')}
        large
      >
        <DialogScrollContent>
          {loading && <p>Loading licenses...</p>}
          {error && (
            <p>Failed to load licenses.<br/>{error.message}</p>
          )}

          {!loading && !error && (
            <div>
              <p>
                This application uses the following open-source
                dependencies ({licenses.length} packages).
              </p>

              {licenses.map(Package)}
            </div>
          )}
        </DialogScrollContent>
      </Dialog>
    </>
  );
};
