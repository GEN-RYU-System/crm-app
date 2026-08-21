import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../FormField/FormField.css';
import './Combobox.css';

const MAX_CANDIDATES = 10;
const DROPDOWN_MAX_H_PX = 320; // max-height: 20rem at 16px base
const DROPDOWN_GAP_PX = 4;
const DROPDOWN_MIN_H_PX = 80;

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
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputId   = useId();
  const listboxId = useId();
  const wrapRef   = useRef<HTMLDivElement>(null);

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

  // Compute fixed-position dropdown coordinates synchronously after layout
  // to avoid flash of incorrectly-positioned dropdown.
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
      <div className="ui-field__input-wrap combobox__wrap" ref={wrapRef}>
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
        {isOpen && createPortal(
          <ul
            id={listboxId}
            className="combobox__dropdown"
            role="listbox"
            style={dropdownStyle}
          >
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
