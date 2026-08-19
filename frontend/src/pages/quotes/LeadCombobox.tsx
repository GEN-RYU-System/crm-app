import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { LeadOption } from '../../gas/client';
import '../../components/ui/FormField/FormField.css';
import './LeadCombobox.css';

const MAX_CANDIDATES = 10;

type Props = {
  leads: LeadOption[];
  value: string;
  onChange: (leadId: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  noResultsText?: string;
  error?: string;
  width?: 'sm' | 'md' | 'lg';
};

export function LeadCombobox({
  leads, value, onChange, label, required, disabled,
  placeholder, noResultsText, error, width = 'md'
}: Props) {
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen]       = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputId   = useId();
  const listboxId = useId();

  // Sync display text when value or leads list changes (e.g. loading existing quote)
  useEffect(() => {
    if (!value) { setInputText(''); return; }
    const found = leads.find((l) => l.leadId === value);
    setInputText(found ? found.customerName : value);
  }, [value, leads]);

  const candidates = useMemo<LeadOption[]>(() => {
    if (!isOpen) return [];
    const term = inputText.toLowerCase().trim();
    if (!term) return leads.slice(0, MAX_CANDIDATES);
    return leads
      .filter((l) => l.customerName.toLowerCase().includes(term))
      .slice(0, MAX_CANDIDATES);
  }, [leads, inputText, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    setActiveIndex(-1);
    setIsOpen(true);
    if (value) onChange('');
  };

  const handleSelect = (lead: LeadOption) => {
    setInputText(lead.customerName);
    onChange(lead.leadId);
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

  const handleFocus = () => {
    if (!value) setIsOpen(true);
  };

  const handleBlur = () => {
    // Delay so mousedown on an option fires before the blur closes the list
    setTimeout(() => {
      setIsOpen(false);
      setActiveIndex(-1);
      if (!value) setInputText('');
    }, 150);
  };

  const widthClass = `ui-field--width-${width}`;
  const errorClass = error ? ' ui-field--error' : '';

  return (
    <div
      ref={wrapperRef}
      className={`ui-field ui-field--md ${widthClass}${errorClass}`}
    >
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
          aria-expanded={isOpen && (candidates.length > 0)}
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
              ? candidates.map((lead, i) => (
                <li
                  key={lead.leadId}
                  id={`${listboxId}-opt-${i}`}
                  className={`lead-combobox__option${i === activeIndex ? ' lead-combobox__option--active' : ''}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(lead); }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {lead.customerName}
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
