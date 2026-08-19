import type { InventoryProductOption } from '../../gas/client';
import { Combobox } from '../../components/ui';

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
  return (
    <Combobox
      items={products}
      getKey={(p) => p.productId}
      getLabel={(p) => p.productName}
      onSelect={(product) => product ? onChange(product.productId, product.productName) : onChange('', '')}
      value={value}
      fallbackDisplayText={fallbackDisplayText}
      label={label}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      noResultsText={noResultsText}
      error={error}
      className={className}
    />
  );
}
