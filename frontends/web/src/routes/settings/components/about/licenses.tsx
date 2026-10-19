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
  const { t } = useTranslation();
  return (
    <details className={styles.package}>
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
          <p>{t('newSettings.about.licenses.unavailableLicenseText')}</p>
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
    let cancelled = false;

    import('../../../../../public/licenses-npm.json')
      .then(module => {
        if (!cancelled) {
          setLicenses(module.default as TPackage[]);
        }
      })
      .catch(error => {
        if (cancelled) {
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
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <SettingsItem
        settingName={t('newSettings.about.licenses.title')}
        secondaryText={t('newSettings.about.licenses.description')}
        onClick={() => setShowDialog(true)}
      />

      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        title={t('newSettings.about.licenses.title')}
        large
      >
        <DialogScrollContent>
          {loading && (
            <p>{t('loading')}</p>
          )}
          {error && (
            <p>
              {t('newSettings.about.licenses.error')}
              <br/>
              {error.message}
            </p>
          )}

          {!loading && !error && (
            <div>
              <p>
                {t('newSettings.about.licenses.packagesInfo', {
                  packageCount: licenses.length
                })}
              </p>

              {licenses.map(pkg => (
                <Package
                  key={`${pkg.name}@${pkg.version}`}
                  {...pkg}
                />
              ))}
            </div>
          )}
        </DialogScrollContent>
      </Dialog>
    </>
  );
};
