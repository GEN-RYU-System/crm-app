import { Combobox } from '../../components/ui';
import type { InventoryProductOption } from '../../features/orders/contracts';

type Props = {
  products: InventoryProductOption[];
  value: string;
  onChange: (product: InventoryProductOption | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  noResultsText?: string;
  error?: string;
  className?: string;
};

export function OrderProductCombobox({
  products,
  value,
  onChange,
  label,
  required,
  disabled,
  placeholder,
  noResultsText,
  error,
  className,
}: Props) {
  return (
    <Combobox
      items={products}
      getKey={(p) => p.productId}
      getLabel={(p) => p.productName}
      onSelect={(product) => onChange(product ?? null)}
      value={value}
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
