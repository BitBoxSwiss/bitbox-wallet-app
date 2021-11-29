/**
 * Copyright 2021 Shift Crypto AG
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

import { h, JSX, RenderableProps } from 'preact';
import * as styles from './vasp.module.css';
import AOPPGroupLogo from '../../assets/exchanges/logos/aoppgroup.svg';
import BitcoinSuisseLogo from '../../assets/exchanges/logos/bitcoin_suisse.png';
import BittrLogo from '../../assets/exchanges/logos/bittr.png';
import BityLogo from '../../assets/exchanges/logos/bity.png';
import PocketBitcoinLogo from '../../assets/exchanges/logos/pocketbitcoin.svg';

interface VASPProps {
    fallback?: JSX.Element;
    hostname: string;
    prominent?: boolean;
    withLogoText?: string;
}

const VASPLogoMap = {
    'demo.aopp.group': AOPPGroupLogo,
    'testing.aopp.group': AOPPGroupLogo,
    'bitcoinsuisse.com': BitcoinSuisseLogo,
    'bity.com': BityLogo,
    'getbittr.com': BittrLogo,
    'pocketbitcoin.com': PocketBitcoinLogo,
};

const VASPHostnameMap = {
    'demo.aopp.group': 'AOPP.group',
    'testing.aopp.group': 'AOPP.group',
};

export function Vasp({
    fallback,
    hostname,
    prominent,
    withLogoText,
}: RenderableProps<VASPProps>) {
    const hasLogo = hostname in VASPLogoMap;
    if (!hasLogo) {
        return fallback || (<div className={styles.hostname}>{hostname}</div>);
    }
    const logoClasses = prominent ? `${styles.logo} ${styles.prominent}` : styles.logo;
    return (
        <div>
            <img className={logoClasses} src={VASPLogoMap[hostname]} alt={hostname} />
            <p className={`${styles.hostname} ${styles.capitalized}`}>
                {hostname in VASPHostnameMap ? VASPHostnameMap[hostname] : hostname}
            </p>
            {withLogoText ? (<p>{withLogoText}</p>) : null}
        </div>
    );
}
