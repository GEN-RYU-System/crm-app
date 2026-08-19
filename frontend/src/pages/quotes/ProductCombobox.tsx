import { useEffect, useId, useMemo, useState } from 'react';
import type { InventoryProductOption } from '../../gas/client';
import '../../components/ui/FormField/FormField.css';
import './LeadCombobox.css';

const MAX_CANDIDATES = 10;

type Props = {
  products: InventoryProductOption[];
  value: string;
  onChange: (productId: string, productName: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  noResultsText?: string;
  error?: string;
  fallbackDisplayText?: string;
  className?: string;
};

export function ProductCombobox({
  products, value, onChange, label, required, disabled,
  placeholder, noResultsText, error, fallbackDisplayText, className
}: Props) {
  const [inputText, setInputText]     = useState('');
  const [isOpen, setIsOpen]           = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputId   = useId();
  const listboxId = useId();

  useEffect(() => {
    if (!value) { setInputText(''); return; }
    const found = products.find((p) => p.productId === value);
    setInputText(found ? found.productName : (fallbackDisplayText ?? value));
  }, [value, products, fallbackDisplayText]);

  const candidates = useMemo<InventoryProductOption[]>(() => {
    if (!isOpen) return [];
    const term = inputText.toLowerCase().trim();
    if (!term) return products.slice(0, MAX_CANDIDATES);
    return products
      .filter((p) => p.productName.toLowerCase().includes(term))
      .slice(0, MAX_CANDIDATES);
  }, [products, inputText, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    setActiveIndex(-1);
    setIsOpen(true);
    if (value) onChange('', '');
  };

  const handleSelect = (product: InventoryProductOption) => {
    setInputText(product.productName);
    onChange(product.productId, product.productName);
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

  const errorClass = error ? ' ui-field--error' : '';

  return (
    <div className={`ui-field ui-field--md${errorClass}${className ? ` ${className}` : ''}`}>
      {label && (
        <label className="ui-field__label" htmlFor={inputId}>
          {label}
          {required && <span className="ui-field__required" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="ui-field__input-wrap lead-combobox__wrap">
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
          <ul id={listboxId} className="lead-combobox__dropdown" role="listbox">
            {candidates.length > 0
              ? candidates.map((product, i) => (
                <li
                  key={product.productId}
                  id={`${listboxId}-opt-${i}`}
                  className={`lead-combobox__option${i === activeIndex ? ' lead-combobox__option--active' : ''}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(product); }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {product.productName}
                </li>
              ))
              : noResultsText && (
                <li className="lead-combobox__option--empty" role="option" aria-disabled="true">
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
