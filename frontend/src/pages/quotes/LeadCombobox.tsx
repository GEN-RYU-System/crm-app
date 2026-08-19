import type { LeadOption } from '../../gas/client';
import { Combobox } from '../../components/ui';

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
  return (
    <Combobox
      items={leads}
      getKey={(lead) => lead.leadId}
      getLabel={(lead) => lead.customerName}
      onSelect={(lead) => onChange(lead ? lead.leadId : '')}
      value={value}
      width={width}
      label={label}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      noResultsText={noResultsText}
      error={error}
    />
  );
}
