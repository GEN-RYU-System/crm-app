import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../FormField/FormField.css';
import './MultiSelect.css';

const MAX_CANDIDATES = 10;
const DROPDOWN_MAX_H_PX = 320;
const DROPDOWN_GAP_PX = 4;
const DROPDOWN_MIN_H_PX = 80;

export type MultiSelectProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  values: readonly string[];
  onChange: (next: string[]) => void;
  fallbackLabels?: Record<string, string>;
  /** Returns the accessible label for the remove button of a given tag. Default: "Remove {label}" */
  getRemoveLabel?: (displayLabel: string) => string;
  width?: 'sm' | 'md' | 'lg';
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  noResultsText?: string;
  error?: string;
};

export function MultiSelect<T>({
  items, getKey, getLabel, values, onChange,
  fallbackLabels, getRemoveLabel, width = 'md', label, required, disabled,
  placeholder, noResultsText, error,
}: MultiSelectProps<T>) {
  const defaultRemoveLabel = (displayLabel: string) => `Remove ${displayLabel}`;
  const resolveRemoveLabel = getRemoveLabel ?? defaultRemoveLabel;
  const [filter, setFilter]         = useState('');
  const [isOpen, setIsOpen]         = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const inputId   = useId();
  const listboxId = useId();
  const wrapRef   = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(values), [values]);

  const candidates = useMemo<T[]>(() => {
    if (!isOpen) return [];
    const term = filter.toLowerCase().trim();
    return items
      .filter((item) => !selectedSet.has(getKey(item)))
      .filter((item) => !term || getLabel(item).toLowerCase().includes(term))
      .slice(0, MAX_CANDIDATES);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filter, isOpen, selectedSet]);

  useLayoutEffect(() => {
    if (!isOpen || !wrapRef.current) return;

    const update = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP_PX;
      const spaceAbove = rect.top - DROPDOWN_GAP_PX;
      const openUpward = spaceAbove > spaceBelow && spaceBelow < DROPDOWN_MAX_H_PX;

      if (openUpward) {
        setDropdownStyle({
          position: 'fixed',
          bottom: window.innerHeight - rect.top + DROPDOWN_GAP_PX,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.max(spaceAbove, DROPDOWN_MIN_H_PX),
        });
      } else {
        setDropdownStyle({
          position: 'fixed',
          top: rect.bottom + DROPDOWN_GAP_PX,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.max(spaceBelow, DROPDOWN_MIN_H_PX),
        });
      }
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  const addValue = (key: string) => {
    if (!selectedSet.has(key)) onChange([...values, key]);
    setFilter('');
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const removeValue = (key: string) => {
    onChange(values.filter((v) => v !== key));
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
    setActiveIndex(-1);
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) { setIsOpen(true); return; }
      setActiveIndex((i) => Math.min(i + 1, candidates.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && activeIndex >= 0 && candidates[activeIndex]) {
        addValue(getKey(candidates[activeIndex]));
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Backspace' && filter === '' && values.length > 0) {
      removeValue(values[values.length - 1]);
    }
  };

  const handleFocus = () => setIsOpen(true);

  const handleBlur = () => {
    setTimeout(() => {
      setIsOpen(false);
      setActiveIndex(-1);
      setFilter('');
    }, 150);
  };

  const resolveLabel = (key: string): string => {
    const item = items.find((it) => getKey(it) === key);
    if (item) return getLabel(item);
    return fallbackLabels?.[key] ?? key;
  };

  const widthClass = `ui-field--width-${width}`;
  const errorClass = error ? ' ui-field--error' : '';

  return (
    <div className={`ui-field ui-field--md ${widthClass}${errorClass}`}>
      {label && (
        <label className="ui-field__label" htmlFor={inputId}>
          {label}
          {required && <span className="ui-field__required" aria-hidden="true">*</span>}
        </label>
      )}
      <div
        className={`ui-field__input-wrap multiselect__wrap${isOpen ? ' multiselect__wrap--open' : ''}${disabled ? ' multiselect__wrap--disabled' : ''}`}
        ref={wrapRef}
        onClick={() => { if (!disabled) inputRef.current?.focus(); }}
      >
        {values.map((key) => (
          <span key={key} className="multiselect__tag">
            <span className="multiselect__tag-label">{resolveLabel(key)}</span>
            {!disabled && (
              <button
                type="button"
                className="multiselect__tag-remove"
                aria-label={resolveRemoveLabel(resolveLabel(key))}
                onMouseDown={(e) => { e.preventDefault(); removeValue(key); }}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          className="multiselect__input"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          value={filter}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={values.length === 0 ? placeholder : undefined}
          disabled={disabled}
          autoComplete="off"
        />
        {isOpen && createPortal(
          <ul
            id={listboxId}
            className="multiselect__dropdown"
            role="listbox"
            aria-multiselectable="true"
            style={dropdownStyle}
          >
            {candidates.length > 0
              ? candidates.map((item, i) => (
                <li
                  key={getKey(item)}
                  id={`${listboxId}-opt-${i}`}
                  className={`multiselect__option${i === activeIndex ? ' multiselect__option--active' : ''}`}
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => { e.preventDefault(); addValue(getKey(item)); }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {getLabel(item)}
                </li>
              ))
              : noResultsText && (
                <li className="multiselect__option--empty" role="option" aria-disabled="true">
                  {noResultsText}
                </li>
              )
            }
          </ul>,
          document.body
        )}
      </div>
      {error && (
        <p className="ui-field__hint ui-field__hint--error" role="alert">{error}</p>
      )}
    </div>
  );
}
