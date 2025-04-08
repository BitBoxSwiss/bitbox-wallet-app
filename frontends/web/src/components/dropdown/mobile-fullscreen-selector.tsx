/**
 * Copyright 2025 Shift Crypto AG
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

import { ReactNode, useState, useEffect } from 'react';
import { ActionMeta } from 'react-select';
import { TOption } from './dropdown';
import { ChevronLeftDark } from '@/components/icon';
import { useTranslation } from 'react-i18next';
import styles from './mobile-fullscreen-selector.module.css';

type Props<T, IsMulti extends boolean = false> = {
  title?: string;
  options: TOption<T>[];
  renderOptions: (option: TOption<T>) => ReactNode;
  value: IsMulti extends true ? TOption<T>[] : TOption<T>;
  onChange: (newValue: IsMulti extends true ? TOption<T>[] : TOption<T>, actionMeta: ActionMeta<TOption<T>>) => void;
  isMulti?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export const MobileFullscreenSelector = <T, IsMulti extends boolean = false>({
  title = 'Select',
  options,
  renderOptions,
  value,
  onChange,
  isMulti,
  isOpen: controlledIsOpen,
  onOpenChange,
}: Props<T, IsMulti>) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const { t } = useTranslation();

  const isControlled = controlledIsOpen !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
    }
  }, [isOpen]);

  const handleOpen = () => {
    if (isControlled && onOpenChange) {
      onOpenChange(true);
    } else {
      setInternalIsOpen(true);
    }
  };

  const handleClose = () => {
    if (isControlled && onOpenChange) {
      onOpenChange(false);
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleBackButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleClose();
  };

  const isSelected = (option: TOption<T>) => {
    if (isMulti) {
      return (value as TOption<T>[]).some((v) => v.value === option.value);
    }
    return (value as TOption<T>).value === option.value;
  };

  const handleSelect = (option: TOption<T>, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMulti) {
      const currentValues = value as TOption<T>[];
      const isCurrentlySelected = currentValues.some((v) => v.value === option.value);

      let newValue: TOption<T>[];
      if (isCurrentlySelected) {
        newValue = currentValues.filter((v) => v.value !== option.value);
      } else {
        newValue = [...currentValues, option];
      }

      onChange(newValue as any, { action: isCurrentlySelected ? 'deselect-option' : 'select-option', option } as any);
    } else {
      onChange(option as any, { action: 'select-option', option } as any);
      handleClose();
    }
  };

  const displayValue = isMulti
    ? (value as TOption<T>[]).map(v => v.label).join(', ') || 'Select...'
    : (value as TOption<T>).label || 'Select...';

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className={styles.dropdownContainer}>
      <button
        className={styles.mobileDropdownTrigger}
        onClick={handleOpen}
        type="button"
      >
        <span className={styles.mobileDropdownValue}>{displayValue}</span>
        <div className={styles.dropdown} />
      </button>

      {isOpen && (
        <div className={styles.fullscreenOverlay}>
          <div className={styles.fullscreenContent}>
            <div className={styles.fullscreenHeader}>
              <button
                className={styles.backButton}
                onClick={handleBackButtonClick}
                type="button"
                aria-label="Close"
              >
                <ChevronLeftDark />
              </button>
              <h3 className={styles.fullscreenTitle}>{title}</h3>
            </div>

            <div className={styles.searchContainer}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder={`${t('generic.search')}...`}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className={styles.optionsList}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={String(option.value)}
                    className={`${styles.optionItem} ${isSelected(option) ? styles.selectedOption : ''}`}
                    onClick={(e) => handleSelect(option, e)}
                    type="button"
                  >
                    <div className={styles.optionContent}>{renderOptions(option)}</div>
                  </button>
                ))
              ) : (
                <div className={styles.noOptions}>{t('generic.noOptions')}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};