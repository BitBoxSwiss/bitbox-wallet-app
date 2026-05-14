// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TSelectedUTXOs } from '../../utxos';
import style from './selected-utxos.module.css';

type TUTXOsByAddress = {
  [address: string]: string[];
};

const groupUTXOsByAddress = (selectedUTXOs: TSelectedUTXOs): TUTXOsByAddress => {
  const utxosByAddress: TUTXOsByAddress = {};
  for (const [outpoint, address] of Object.entries(selectedUTXOs)) {
    if (!utxosByAddress[address]) {
      utxosByAddress[address] = [];
    }
    utxosByAddress[address].push(outpoint);
  }
  return utxosByAddress;
};

type TProps = {
  selectedUTXOs: TSelectedUTXOs;
  title?: string;
};

export const SelectedUTXOs = ({
  selectedUTXOs,
  title,
}: TProps) => {
  const { t } = useTranslation();
  const groupedUTXOs = Object.entries(groupUTXOsByAddress(selectedUTXOs));

  if (groupedUTXOs.length === 0) {
    return null;
  }

  return (
    <div className={style.selectedUTXOs}>
      <span className={style.label}>
        {title ?? t('send.confirm.selected-coins')}
      </span>
      <div>
        {groupedUTXOs.map(([address, outpoints]) => (
          <div key={address || 'unknown'} className={style.addressGroup}>
            <div className={style.address}>
              {address || t('generic.unknown')}
            </div>
            <ul>
              {outpoints.map((outpoint) => (
                <li key={outpoint} className={style.value}>
                  {outpoint}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
