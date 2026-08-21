import { Combobox } from '../Combobox/Combobox';
import { Select } from '../Select/Select';
import { TextField } from '../TextField/TextField';
import { Button } from '../Button/Button';
import { lineItemEditorCopy } from '../../../content/ja/lineItemEditor';
import './LineItemEditor.css';

export type LineItemValue = {
  productId: string;
  productName: string;
  condition: string;
  quantity: string;
  unitPrice: string;
  unitWeight: number;
};

type LineItemCondition = {
  condition: string;
  quantity: number;
  unitPrice: number;
  unitWeight: number;
};

export type LineItemEditorLabels = {
  product: string;
  productPlaceholder: string;
  productNoResults: string;
  condition: string;
  conditionPlaceholder: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  weight: string;
  remove: string;
  conditionOptionLabel?: (condition: string, quantity: number) => string;
};

export type LineItemEditorProps = {
  products: readonly { productId: string; productName: string }[];
  lines: readonly LineItemValue[];
  conditionsMap: Map<string, LineItemCondition[]>;
  onProductSelect: (index: number, productId: string, productName: string) => void;
  onConditionSelect: (index: number, condition: string) => void;
  onQuantityChange: (index: number, value: string) => void;
  onUnitPriceChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  lineErrors?: Map<number, string>;
  disabled?: boolean;
  labels?: LineItemEditorLabels;
};

const DEFAULT_LABELS: LineItemEditorLabels = { ...lineItemEditorCopy };

function toHalf(value: string): string {
  return value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

type ProductItem = { productId: string; productName: string };

export function LineItemEditor({
  products,
  lines,
  conditionsMap,
  onProductSelect,
  onConditionSelect,
  onQuantityChange,
  onUnitPriceChange,
  onRemove,
  lineErrors,
  disabled = false,
  labels = DEFAULT_LABELS,
}: LineItemEditorProps) {
  const conditionLabel = labels.conditionOptionLabel ?? lineItemEditorCopy.conditionOptionLabel;

  return (
    <div className="line-item-editor__lines">
      {lines.map((line, index) => {
        const conditions = conditionsMap.get(line.productId) ?? [];
        const conditionOptions = conditions.map((c) => ({
          value: c.condition,
          label: conditionLabel(c.condition, c.quantity),
        }));
        const qty = Number(toHalf(line.quantity));
        const price = Number(toHalf(line.unitPrice));
        const amount =
          line.quantity !== '' && Number.isFinite(qty) && line.unitPrice !== '' && Number.isFinite(price)
            ? qty * price
            : null;
        const weight =
          line.quantity !== '' && Number.isFinite(qty) && line.unitWeight > 0
            ? Math.round(line.unitWeight * qty)
            : 0;
        const lineError = lineErrors?.get(index);

        return (
          <div key={index} className="line-item-editor__row">
            <span className="line-item-editor__line-no">{index + 1}</span>

            <Combobox
              className="line-item-editor__product"
              items={products as ProductItem[]}
              getKey={(p) => p.productId}
              getLabel={(p) => p.productName}
              onSelect={(product) =>
                product
                  ? onProductSelect(index, product.productId, product.productName)
                  : onProductSelect(index, '', '')
              }
              value={line.productId}
              fallbackDisplayText={line.productName}
              label={labels.product}
              placeholder={labels.productPlaceholder}
              noResultsText={labels.productNoResults}
              disabled={disabled}
            />

            <Select
              className="line-item-editor__condition"
              label={labels.condition}
              options={conditionOptions}
              value={line.condition}
              onChange={(e) => onConditionSelect(index, e.target.value)}
              disabled={disabled || !line.productId}
              placeholder={labels.conditionPlaceholder}
            />

            <TextField
              className="line-item-editor__qty"
              label={labels.quantity}
              value={line.quantity}
              onChange={(e) => onQuantityChange(index, e.target.value)}
              disabled={disabled || !line.condition}
              error={lineError}
            />

            <TextField
              className="line-item-editor__price"
              label={labels.unitPrice}
              value={line.unitPrice}
              onChange={(e) => onUnitPriceChange(index, e.target.value)}
              disabled={disabled}
            />

            <div className="line-item-editor__calc">
              <span className="line-item-editor__calc-label">{labels.amount}</span>
              <span className="line-item-editor__calc-value">
                {amount != null ? amount.toLocaleString() : '—'}
              </span>
            </div>

            <div className="line-item-editor__calc">
              <span className="line-item-editor__calc-label">{labels.weight}</span>
              <span className="line-item-editor__calc-value">{weight > 0 ? `${weight}g` : '—'}</span>
            </div>

            {!disabled && (
              <Button
                className="line-item-editor__remove"
                variant="outline"
                size="sm"
                onClick={() => onRemove(index)}
              >
                {labels.remove}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
