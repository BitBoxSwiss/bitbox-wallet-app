// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionMeta } from 'react-select';
import { TOption, TGroupedOption, isGroupedOptions } from './dropdown';
import { ChevronLeftDark } from '@/components/icon';
import { UseBackButton } from '@/hooks/backbutton';
import styles from './mobile-fullscreen-selector.module.css';

type Props<T, IsMulti extends boolean = false, TExtra = object, TOptionExt = object> = {
  title: string;
  options?: TOption<T>[] | TGroupedOption<T, TExtra, TOptionExt>[];
  renderOptions: (option: TOption<T> & TOptionExt, isSelectedValue: boolean) => ReactNode;
  renderGroupHeader?: (group: TGroupedOption<T, TExtra, TOptionExt>) => ReactNode;
  renderTrigger?: ((props: { onClick: () => void }) => ReactNode);
  value: IsMulti extends true ? TOption<T>[] : TOption<T>;
  onSelect: (newValue: IsMulti extends true ? TOption<T>[] : TOption<T>, actionMeta: ActionMeta<TOption<T>>) => void;
  isMulti?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
};

export const MobileFullscreenSelector = <T, IsMulti extends boolean = false, TExtra = object, TOptionExt = object>({
  title,
  options,
  renderOptions,
  renderGroupHeader,
  renderTrigger,
  value,
  onSelect,
  isMulti,
  isOpen: controlledIsOpen,
  onOpenChange,
}: Props<T, IsMulti, TExtra, TOptionExt>) => {
  const [localIsOpen, setLocalIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const { t } = useTranslation();
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : localIsOpen;
  const isGrouped = isGroupedOptions(options);

  useEffect(() => {
    if (!isOpen) {
      setSearchText('');
    }
  }, [isOpen]);

  const handleOpen = () => {
    if (onOpenChange) {
      onOpenChange(true);
    } else {
      setLocalIsOpen(true);
    }
  };

  const handleClose = () => {
    if (onOpenChange) {
      onOpenChange(false);
    } else {
      setLocalIsOpen(false);
    }
  };

  const isSelected = (option: TOption<T>) => {
    if (isMulti) {
      return (value as TOption<T>[]).some((v) => v.value === option.value);
    }
    return value ? (value as TOption<T>).value === option.value : false;
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

      onSelect(newValue as any, { action: isCurrentlySelected ? 'deselect-option' : 'select-option', option } as any);
    } else {
      onSelect(option as any, { action: 'select-option', option } as any);
      handleClose();
    }
  };

  const displayValue = isMulti
    ? (value as TOption<T>[]).map(v => v.label).reverse().join(', ')
    : (value as TOption<T>)?.label || '';

  const getFilteredOptions = () => {
    if (!options) {
      return [];
    }
    const searchLower = searchText.toLowerCase();

    if (isGrouped) {
      return (options as TGroupedOption<T, TExtra, TOptionExt>[])
        .map(group => ({
          ...group,
          options: group.options.filter(opt =>
            opt.label.toLowerCase().includes(searchLower)
          ),
        }))
        .filter(group => group.options.length > 0);
    }

    return (options as (TOption<T> & TOptionExt)[]).filter(opt =>
      opt.label.toLowerCase().includes(searchLower)
    );
  };

  const filteredOptions = getFilteredOptions();

  const renderFlatOptions = (flatOptions: (TOption<T> & TOptionExt)[]) => (
    flatOptions.map((option) => (
      <button
        key={JSON.stringify(option.value)}
        className={`
          ${styles.optionItem || ''} 
          ${isSelected(option) ? styles.selectedOption || '' : ''}`
        }
        onClick={(e) => handleSelect(option, e)}
      >
        <div className={styles.optionContent}>{renderOptions(option, false)}</div>
      </button>
    ))
  );

  const renderGroupedOptions = (groupedOptions: TGroupedOption<T, TExtra, TOptionExt>[]) => (
    groupedOptions.map((group) => (
      <div key={group.label} className={styles.group}>
        <div className={styles.groupHeader}>
          {renderGroupHeader ? renderGroupHeader(group) : <span>{group.label}</span>}
        </div>
        {group.options.map((option) => (
          <button
            key={JSON.stringify(option.value)}
            type="button"
            className={`${styles.optionItem || ''} ${isSelected(option) ? styles.selectedOption || '' : ''}`}
            onClick={(e) => handleSelect(option, e)}
          >
            <div className={styles.optionContent}>{renderOptions(option, false)}</div>
          </button>
        ))}
      </div>
    ))
  );

  const hasResults = isGrouped
    ? (filteredOptions as TGroupedOption<T, TExtra, TOptionExt>[]).length > 0
    : (filteredOptions as (TOption<T> & TOptionExt)[]).length > 0;

  return (
    <div className={styles.dropdownContainer}>
      <UseBackButton handler={() => {
        handleClose();
        return false;
      }}
      />
      {renderTrigger ? (
        renderTrigger({ onClick: handleOpen })
      ) : onOpenChange ? (
        <div className={styles.mobileSelectorTrigger}>
          <span className={styles.mobileSelectorValue}>{displayValue}</span>
        </div>
      ) : (
        <button
          className={styles.mobileSelectorTrigger}
          onClick={handleOpen}
        >
          <span className={styles.mobileSelectorValue}>{displayValue}</span>
        </button>
      )}

      {isOpen && (
        <div className={styles.fullscreenOverlay}>
          <div className={styles.fullscreenContent}>
            <div className={styles.fullscreenHeader}>
              <button
                className={styles.backButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                type="button"
                aria-label="Close"
              >
                <ChevronLeftDark className={styles.backButtonIcon} />
              </button>
              <h3 className={styles.fullscreenTitle}>{title}</h3>
            </div>

            <div className={styles.searchContainer}>
              <input
                id="search"
                type="text"
                className={styles.searchInput}
                placeholder={`${t('generic.search')}`}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className={styles.optionsList}>
              {hasResults ? (
                isGrouped
                  ? renderGroupedOptions(filteredOptions as TGroupedOption<T, TExtra, TOptionExt>[])
                  : renderFlatOptions(filteredOptions as (TOption<T> & TOptionExt)[])
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