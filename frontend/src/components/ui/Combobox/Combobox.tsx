import { useEffect, useId, useMemo, useState } from 'react';
import '../FormField/FormField.css';
import './Combobox.css';

const MAX_CANDIDATES = 10;

export type ComboboxProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (item: T | null) => void;
  value: string;
  fallbackDisplayText?: string;
  width?: 'sm' | 'md' | 'lg';
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  noResultsText?: string;
  error?: string;
  className?: string;
};

export function Combobox<T>({
  items, getKey, getLabel, onSelect, value,
  fallbackDisplayText, width = 'md', label, required, disabled,
  placeholder, noResultsText, error, className
}: ComboboxProps<T>) {
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen]       = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputId   = useId();
  const listboxId = useId();

  useEffect(() => {
    if (!value) { setInputText(''); return; }
    const found = items.find((item) => getKey(item) === value);
    setInputText(found ? getLabel(found) : (fallbackDisplayText ?? value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items, fallbackDisplayText]);

  const candidates = useMemo<T[]>(() => {
    if (!isOpen) return [];
    const term = inputText.toLowerCase().trim();
    if (!term) return items.slice(0, MAX_CANDIDATES);
    return items
      .filter((item) => getLabel(item).toLowerCase().includes(term))
      .slice(0, MAX_CANDIDATES);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, inputText, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    setActiveIndex(-1);
    setIsOpen(true);
    if (value) onSelect(null);
  };

  const handleSelect = (item: T) => {
    setInputText(getLabel(item));
    onSelect(item);
    setIsOpen(false);
    setActiveIndex(-1);
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
        handleSelect(candidates[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleFocus = () => { if (!value) setIsOpen(true); };

  const handleBlur = () => {
    setTimeout(() => {
      setIsOpen(false);
      setActiveIndex(-1);
      if (!value) setInputText('');
    }, 150);
  };

  const widthClass = `ui-field--width-${width}`;
  const errorClass = error ? ' ui-field--error' : '';

  return (
    <div className={`ui-field ui-field--md ${widthClass}${errorClass}${className ? ` ${className}` : ''}`}>
      {label && (
        <label className="ui-field__label" htmlFor={inputId}>
          {label}
          {required && <span className="ui-field__required" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="ui-field__input-wrap combobox__wrap">
        <input
          id={inputId}
          className="ui-field__input"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="off"
        />
        {isOpen && (
          <ul id={listboxId} className="combobox__dropdown" role="listbox">
            {candidates.length > 0
              ? candidates.map((item, i) => (
                <li
                  key={getKey(item)}
                  id={`${listboxId}-opt-${i}`}
                  className={`combobox__option${i === activeIndex ? ' combobox__option--active' : ''}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {getLabel(item)}
                </li>
              ))
              : noResultsText && (
                <li className="combobox__option--empty" role="option" aria-disabled="true">
                  {noResultsText}
                </li>
              )
            }
          </ul>
        )}
      </div>
      {error && (
        <p className="ui-field__hint ui-field__hint--error" role="alert">{error}</p>
      )}
    </div>
  );
}
