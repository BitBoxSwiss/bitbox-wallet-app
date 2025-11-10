/**
 * Copyright 2021-2025 Shift Crypto AG
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

import styles from './vasp.module.css';
import AOPPGroupLogo from '@/assets/exchanges/logos/aoppgroup.svg';
import BitcoinSuisseLogo from '@/assets/exchanges/logos/bitcoin_suisse.png';
import BittrLogo from '@/assets/exchanges/logos/bittr.png';
import BityLogo from '@/assets/exchanges/logos/bity.png';
import CoinfinityLogo from '@/assets/exchanges/logos/coinfinity.svg';
import PocketBitcoinLogo from '@/assets/exchanges/logos/pocketbitcoin.svg';
import RelaiLogo from '@/assets/exchanges/logos/relai.svg';

type TVASPProps = {
  fallback?: JSX.Element;
  hostname: string;
  prominent?: boolean;
  withLogoText?: string;
};

type TVASPMap = {
  [hostname: string]: string;
};

const VASPLogoMap: TVASPMap = {
  'demo.aopp.group': AOPPGroupLogo,
  'testing.aopp.group': AOPPGroupLogo,
  'bitcoinsuisse.com': BitcoinSuisseLogo,
  'bity.com': BityLogo,
  'coinfinity.co': CoinfinityLogo,
  'getbittr.com': BittrLogo,
  'pocketbitcoin.com': PocketBitcoinLogo,
  'relai.app': RelaiLogo,
};

const VASPHostnameMap: TVASPMap = {
  'demo.aopp.group': 'AOPP.group',
  'testing.aopp.group': 'AOPP.group',
};

export const Vasp = ({
  fallback,
  hostname,
  prominent,
  withLogoText,
}: TVASPProps) => {
  const subdomainOfVasp = Object.keys(VASPLogoMap).find((vasp) => hostname.endsWith(vasp));
  const knownVasp = subdomainOfVasp || (hostname in VASPLogoMap && hostname);

  if (!knownVasp) {
    return fallback || (
      <p className={styles.hostname}>{hostname}</p>
    );
  }

  const logoClasses = prominent ? `
    ${styles.logo || ''}
    ${styles.prominent || ''}
  ` : styles.logo as string;
  return (
    <div>
      <img className={logoClasses} src={VASPLogoMap[knownVasp]} alt={knownVasp} />
      <p className={`${styles.hostname as string} ${styles.capitalized as string}`}>
        {knownVasp in VASPHostnameMap ? VASPHostnameMap[knownVasp] : knownVasp}
      </p>
      {withLogoText ? (<p>{withLogoText}</p>) : null}
    </div>
  );
};
