import { useState } from "react";
import { CRM_NAV_ICONS, CRM_SORT_ICONS } from "../../app/icons";
import { InvoiceDocument } from "../../features/documents/InvoiceDocument";
import { QuoteDocument } from "../../features/documents/QuoteDocument";
import type { DocLine, IssuerInfo } from "../../features/documents/DocumentParts";
import {
  Badge,
  Button,
  Card,
  Combobox,
  ConversationWorkspace,
  DataTable,
  EmptyState,
  HubShell,
  LineItemEditor,
  MultiSelect,
  PageHeader,
  PageToolbar,
  Select,
  Skeleton,
  Spinner,
  StatCard,
  StatusMessage,
  SubMenu,
  TabBar,
  Tabs,
  Textarea,
  TextField,
  TwoColumnLayout,
  type DataTableColumn,
  type LineItemValue,
} from "../../components/ui";
import { catalogCopy, commonCopy, inboxCopy } from "../../content/ja";
import "./ComponentCatalogPage.css";

export function ComponentCatalogPage() {
  const Icon = CRM_NAV_ICONS.components;
  const [activeTab, setActiveTab] = useState("active");
  const [activeTabBar, setActiveTabBar] = useState("active");
  const [activeSubMenu, setActiveSubMenu] = useState("leads");
  const [dataTableSort, setDataTableSort] = useState<
    "ascending" | "descending"
  >("ascending");
  const options = [
    { value: "one", label: catalogCopy.optionOne },
    { value: "two", label: catalogCopy.optionTwo },
    { value: "disabled", label: catalogCopy.disabledOption, disabled: true },
  ];
  const comboboxItems = [
    { id: "a", label: catalogCopy.optionOne },
    { id: "b", label: catalogCopy.optionTwo },
  ];
  const [comboboxValue, setComboboxValue] = useState("");
  const [multiSelectValues, setMultiSelectValues] = useState<string[]>([]);
  const [lineItems, setLineItems] = useState<LineItemValue[]>([
    { productId: "PM0001", productName: catalogCopy.lineItemSampleProductA, condition: "New", quantity: "2", unitPrice: "1000", unitWeight: 200 },
  ]);
  const catalogProducts = [
    { productId: "PM0001", productName: catalogCopy.lineItemSampleProductA },
    { productId: "PM0002", productName: catalogCopy.lineItemSampleProductB },
  ];
  const catalogConditionsMap = new Map([
    ["PM0001", [{ condition: "New", quantity: 10, unitPrice: 1000, unitWeight: 200 }, { condition: "Sealed", quantity: 5, unitPrice: 900, unitWeight: 200 }]],
    ["PM0002", [{ condition: "New", quantity: 3, unitPrice: 2000, unitWeight: 300 }]],
  ]);
  const catalogLineLabels = {
    product: catalogCopy.lineItemProduct,
    productPlaceholder: catalogCopy.lineItemProductPlaceholder,
    productNoResults: catalogCopy.lineItemProductNoResults,
    condition: catalogCopy.lineItemCondition,
    conditionPlaceholder: catalogCopy.lineItemConditionPlaceholder,
    quantity: catalogCopy.lineItemQuantity,
    unitPrice: catalogCopy.lineItemUnitPrice,
    amount: catalogCopy.lineItemAmount,
    weight: catalogCopy.lineItemWeight,
    remove: catalogCopy.lineItemRemove,
  };
  const tabItems = [
    {
      key: "active",
      label: catalogCopy.tabActive,
      icon: <Icon aria-hidden="true" />,
      count: 0,
    },
    { key: "count", label: catalogCopy.tabWithCount, count: 12 },
    { key: "disabled", label: catalogCopy.tabDisabled, disabled: true },
  ];
  const tabBarItems = [
    { key: "active", label: catalogCopy.tabActive },
    { key: "inactive", label: catalogCopy.tabInactive },
    { key: "disabled", label: catalogCopy.tabDisabled, disabled: true },
    { key: "overflow-one", label: catalogCopy.tabBarOverflowOne },
    { key: "overflow-two", label: catalogCopy.tabBarOverflowTwo },
    { key: "overflow-three", label: catalogCopy.tabBarOverflowThree },
    { key: "overflow-four", label: catalogCopy.tabBarOverflowFour },
  ];
  const DataTableSortIcon = CRM_SORT_ICONS[dataTableSort];
  const dataTableRows = [
    {
      id: "catalog-row",
      customer: catalogCopy.dataTableCustomerExample,
      response: catalogCopy.dataTableResponseExample,
      updated: catalogCopy.dataTableUpdatedExample,
    },
  ];
  const dataTableColumns: DataTableColumn<(typeof dataTableRows)[number]>[] = [
    {
      key: "customer",
      header: catalogCopy.dataTableCustomer,
      renderCell: (row) => row.customer,
      ariaSort: dataTableSort,
      onSort: () =>
        setDataTableSort((direction) =>
          direction === "ascending" ? "descending" : "ascending",
        ),
      sortAriaLabel: catalogCopy.dataTableSortLabel(
        catalogCopy.dataTableCustomer,
      ),
      sortIcon: <DataTableSortIcon aria-hidden="true" />,
      cellAlignment: "center",
    },
    {
      key: "response",
      header: catalogCopy.dataTableResponse,
      renderCell: (row) => row.response,
      cellAlignment: "center",
    },
    {
      key: "updated",
      header: catalogCopy.dataTableUpdated,
      renderCell: (row) => row.updated,
      cellAlignment: "center",
    },
  ];

  // ── Document template sample data ──────────────────────────────────────────
  const sampleIssuer: IssuerInfo = {
    name: 'SAMPLE COMPANY LTD.',
    lines: [
      'Taro Yamada',
      '2F, Sample Building, 1-2-3 Shinjuku',
      'Shinjuku-ku, Tokyo, Japan 160-0000',
      'Phone: +81-90-0000-0000',
      'E-mail: billing@example.com',
    ],
  };
  const sampleBilledTo = {
    name: 'SAMPLE CLIENT CO.',
    lines: ['1 Example Street', 'Sample City, SC 10000', 'Country', 'TAX ID: XX-000000'],
  };
  const sampleShipTo = {
    name: 'SAMPLE CLIENT CO.',
    lines: ['1 Example Street', 'Sample City, SC 10000'],
  };
  const makeLines = (count: number, currency: string): DocLine[] =>
    Array.from({ length: count }, (_, i) => ({
      no: i + 1,
      name: `Sample Product ${String.fromCharCode(65 + (i % 26))}`,
      qty: String((i % 5) + 1),
      unitPrice: currency === 'USD' ? `$${((i + 1) * 50).toLocaleString()}.00` : `\u00a5${((i + 1) * 5000).toLocaleString()}`,
      amount: currency === 'USD' ? `$${(((i % 5) + 1) * (i + 1) * 50).toLocaleString()}.00` : `\u00a5${(((i % 5) + 1) * (i + 1) * 5000).toLocaleString()}`,
    }));
  const sampleLines5 = makeLines(5, 'JPY');
  const sampleLines25 = makeLines(25, 'JPY');
  const sampleLinesUsd = makeLines(5, 'USD');

  return (
    <>
      <PageHeader
        eyebrow={catalogCopy.eyebrow}
        title={catalogCopy.title}
        subtitle={catalogCopy.subtitle}
      />
      <div className="catalog-page__stack">
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.button}</h2>
          <div className="catalog-page__row">
            <Button>{commonCopy.primary}</Button>
            <Button variant="secondary">{commonCopy.secondary}</Button>
            <Button variant="danger">{commonCopy.danger}</Button>
            <Button variant="ghost">{commonCopy.ghost}</Button>
            <Button variant="outline">{commonCopy.outline}</Button>
            <Button size="sm">{catalogCopy.small}</Button>
            <Button size="md">{catalogCopy.medium}</Button>
            <Button size="lg">{catalogCopy.large}</Button>
            <Button loading loadingText={commonCopy.loading}>
              {commonCopy.primary}
            </Button>
            <Button disabled>{commonCopy.disabled}</Button>
            <Button fullWidth>{catalogCopy.fullWidth}</Button>
            <Button iconOnly aria-label={catalogCopy.iconOnlyLabel}>
              <Icon aria-hidden="true" />
            </Button>
          </div>
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.tabs}</h2>
          <div className="catalog-page__stack">
            <Tabs
              items={tabItems}
              activeKey={activeTab}
              onChange={setActiveTab}
              variant="pill"
              size="md"
              aria-label={catalogCopy.tabsLabel}
            />
            <Tabs
              items={tabItems}
              activeKey={activeTab}
              onChange={setActiveTab}
              variant="underline"
              size="sm"
              aria-label={catalogCopy.tabsLabel}
            />
          </div>
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.tabBar}</h2>
          <div className="catalog-page__tab-bar-demo">
            <TabBar
              items={tabBarItems}
              activeKey={activeTabBar}
              onChange={setActiveTabBar}
              aria-label={catalogCopy.tabBarLabel}
            />
          </div>
        </Card>
        <Card>
          <h2 className="catalog-page__heading">
            {catalogCopy.pageToolbar}
          </h2>
          <PageToolbar
            start={
              <TextField
                aria-label={catalogCopy.textLabel}
                placeholder={catalogCopy.placeholder}
                fullWidth
              />
            }
            end={
              <div className="catalog-page__row">
                <Button variant="secondary">{commonCopy.secondary}</Button>
                <Button>{commonCopy.primary}</Button>
              </div>
            }
          />
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.hubShellSubMenu}</h2>
          <HubShell
            navigationLabel={catalogCopy.subMenuLabel}
            navigation={
              <SubMenu
                variant="grouped"
                groups={[{ title: catalogCopy.subMenuGroup, items: [
                  { key: "leads", label: catalogCopy.subMenuLeads, icon: <CRM_NAV_ICONS.leads aria-hidden="true" /> },
                  { key: "disabled", label: catalogCopy.tabDisabled, disabled: true },
                ] }]}
                activeKey={activeSubMenu}
                onChange={setActiveSubMenu}
                ariaLabel={catalogCopy.subMenuLabel}
              />
            }
          >
            <Card variant="outlined">{catalogCopy.hubContentExample}</Card>
          </HubShell>
        </Card>
        <Card>
          <h2 className="catalog-page__heading">
            {catalogCopy.dataTable}（{catalogCopy.dataTableCenterAligned}）
          </h2>
          <div className="catalog-page__stack">
            <DataTable
              ariaLabel={catalogCopy.dataTableLabel}
              columns={dataTableColumns}
              rows={dataTableRows}
              rowKey={(row) => row.id}
            />
            <DataTable
              ariaLabel={catalogCopy.dataTableLabel}
              columns={dataTableColumns}
              rows={[]}
              rowKey={(row) => row.id}
              loading
              loadingLabel={catalogCopy.dataTableLoadingLabel}
              skeletonRows={3}
            />
          </div>
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.conversationWorkspace} / {inboxCopy.title}</h2>
          <ConversationWorkspace
            listLabel={catalogCopy.conversationListLabel}
            listHeader={<strong>{catalogCopy.conversationList}</strong>}
            list={<span>{catalogCopy.conversationListExample}</span>}
            conversationLabel={catalogCopy.conversationLabel}
            conversationHeader={<strong>{catalogCopy.conversation}</strong>}
            conversation={<span>{catalogCopy.conversationExample}</span>}
            detailsLabel={catalogCopy.conversationDetailsLabel}
            detailsHeader={<strong>{catalogCopy.conversationDetails}</strong>}
            details={<span>{catalogCopy.conversationDetailsExample}</span>}
          />
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.badge}</h2>
          <div className="catalog-page__row">
            {(
              ["neutral", "info", "success", "warning", "danger"] as const
            ).flatMap((variant) => [
              <Badge
                key={`${variant}-soft`}
                variant={variant}
                appearance="soft"
                size="sm"
              >
                {catalogCopy.badgeVariants[variant]} {catalogCopy.soft}
              </Badge>,
              <Badge
                key={`${variant}-solid`}
                variant={variant}
                appearance="solid"
                size="md"
              >
                {catalogCopy.badgeVariants[variant]} {catalogCopy.solid}
              </Badge>,
            ])}
            <Badge variant="success" dot>
              {catalogCopy.badgeVariants.success}
            </Badge>
            <Badge variant="info" icon={<Icon aria-hidden="true" />}>
              {catalogCopy.badgeVariants.info}
            </Badge>
          </div>
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.skeleton}</h2>
          <div className="catalog-page__grid">
            <Skeleton label={catalogCopy.skeletonLabel} />
            <Skeleton
              variant="table"
              rows={4}
              label={catalogCopy.skeletonLabel}
            />
            <Skeleton
              variant="table"
              rows={4}
              columns={7}
              label={catalogCopy.skeletonLabel}
            />
            <Skeleton
              variant="list"
              rows={4}
              label={catalogCopy.skeletonLabel}
            />
            <Skeleton
              variant="card"
              rows={4}
              label={catalogCopy.skeletonLabel}
            />
          </div>
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.lineItemEditor}</h2>
          <LineItemEditor
            products={catalogProducts}
            lines={lineItems}
            conditionsMap={catalogConditionsMap}
            onProductSelect={(index, productId, productName) =>
              setLineItems((prev) =>
                prev.map((l, i) =>
                  i === index ? { ...l, productId, productName, condition: "", unitPrice: "", unitWeight: 0 } : l
                )
              )
            }
            onConditionSelect={(index, condition) =>
              setLineItems((prev) =>
                prev.map((l, i) => {
                  if (i !== index) return l;
                  const conds = catalogConditionsMap.get(l.productId) ?? [];
                  const found = conds.find((c) => c.condition === condition);
                  return { ...l, condition, unitPrice: found ? String(found.unitPrice) : l.unitPrice, unitWeight: found ? found.unitWeight : 0 };
                })
              )
            }
            onQuantityChange={(index, value) =>
              setLineItems((prev) => prev.map((l, i) => i === index ? { ...l, quantity: value } : l))
            }
            onUnitPriceChange={(index, value) =>
              setLineItems((prev) => prev.map((l, i) => i === index ? { ...l, unitPrice: value } : l))
            }
            onRemove={(index) => setLineItems((prev) => prev.filter((_, i) => i !== index))}
            labels={catalogLineLabels}
          />
          <Button variant="outline" size="sm" onClick={() => setLineItems((prev) => [...prev, { productId: "", productName: "", condition: "", quantity: "", unitPrice: "", unitWeight: 0 }])}>
            {catalogCopy.lineItemAddLine}
          </Button>
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.combobox}</h2>
          <Combobox
            items={comboboxItems}
            getKey={(item) => item.id}
            getLabel={(item) => item.label}
            onSelect={(item) => setComboboxValue(item ? item.id : "")}
            value={comboboxValue}
            label={catalogCopy.comboboxLabel}
            placeholder={catalogCopy.comboboxPlaceholder}
            noResultsText={catalogCopy.comboboxNoResults}
          />
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.multiSelect}</h2>
          <MultiSelect
            items={comboboxItems}
            getKey={(item) => item.id}
            getLabel={(item) => item.label}
            values={multiSelectValues}
            onChange={setMultiSelectValues}
            label={catalogCopy.multiSelectLabel}
            placeholder={catalogCopy.multiSelectPlaceholder}
            noResultsText={catalogCopy.multiSelectNoResults}
            getRemoveLabel={catalogCopy.multiSelectRemove}
          />
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.formField}</h2>
          <TextField
            size="sm"
            label={catalogCopy.textLabel}
            helperText={catalogCopy.helper}
            placeholder={catalogCopy.placeholder}
          />
          <TextField
            size="md"
            label={catalogCopy.errorLabel}
            error={catalogCopy.error}
            defaultValue={catalogCopy.invalidValue}
          />
          <TextField
            size="lg"
            label={catalogCopy.requiredLabel}
            required
            placeholder={catalogCopy.placeholder}
          />
          <TextField
            label={catalogCopy.disabledLabel}
            disabled
            defaultValue={catalogCopy.disabledLabel}
          />
          <TextField
            label={catalogCopy.fullWidthLabel}
            fullWidth
            placeholder={catalogCopy.placeholder}
          />
          <Textarea
            size="sm"
            label={catalogCopy.textareaLabel}
            helperText={catalogCopy.helper}
            placeholder={catalogCopy.placeholder}
          />
          <Textarea size="md" label={catalogCopy.requiredLabel} required />
          <Textarea size="lg" label={catalogCopy.disabledLabel} disabled />
          <Textarea
            label={catalogCopy.fullWidthLabel}
            fullWidth
            error={catalogCopy.error}
          />
          <Select
            size="sm"
            label={catalogCopy.selectLabel}
            options={options}
            placeholder={catalogCopy.selectPlaceholder}
            helperText={catalogCopy.helper}
          />
          <Select
            size="md"
            label={catalogCopy.requiredLabel}
            options={options}
            required
          />
          <Select
            size="lg"
            label={catalogCopy.disabledLabel}
            options={options}
            disabled
          />
          <Select
            label={catalogCopy.fullWidthLabel}
            options={options}
            fullWidth
            error={catalogCopy.error}
          />
        </Card>
        <Card>
          <h2 className="catalog-page__heading">
            {catalogCopy.spinnerEmptyState}
          </h2>
          <div className="catalog-page__row">
            <Spinner size="sm" aria-label={catalogCopy.spinnerSmallLabel} />
            <Spinner aria-label={catalogCopy.spinnerMediumLabel} />
            <Spinner size="lg" aria-label={catalogCopy.spinnerLargeLabel} />
          </div>
          <EmptyState
            title={catalogCopy.emptyTitle}
            description={catalogCopy.helper}
            action={
              <Button variant="secondary">{commonCopy.actionExample}</Button>
            }
          />
        </Card>
        <Card>
          <h2 className="catalog-page__heading">TwoColumnLayout</h2>
          <p className="catalog-page__copy">
            usedIn: orders, quotes — Two-column layout skeleton: left column (main content) and right column (sticky summary panel).
            Collapses to a single column on narrow screens (max-width: 900px).
          </p>
          <TwoColumnLayout
            left={
              <Card variant="outlined">
                <p className="catalog-page__copy">Left column (main content)</p>
              </Card>
            }
            right={
              <div style={{ background: "var(--color-surface)", border: "var(--border-width) solid var(--color-border)", borderRadius: "var(--radius-surface)", padding: "var(--space-xl)" }}>
                <p className="catalog-page__copy">Right column (sticky summary)</p>
              </div>
            }
          />
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.statCard}</h2>
          <div className="catalog-page__row">
            <StatCard
              label={catalogCopy.statCardLabel}
              value={catalogCopy.statCardValue}
              help={catalogCopy.statCardHelp}
            />
          </div>
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.statusMessage}</h2>
          <div className="catalog-page__stack">
            <StatusMessage variant="loading">{catalogCopy.statusMessageLoading}</StatusMessage>
            <StatusMessage variant="error">{catalogCopy.statusMessageError}</StatusMessage>
            <StatusMessage variant="empty">{catalogCopy.statusMessageEmpty}</StatusMessage>
          </div>
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.pageTemplate}</h2>
          <p className="catalog-page__copy">{catalogCopy.pageTemplateDesc}</p>
          <div className="catalog-page__page-template">
            <section>
              <p className="catalog-page__subheading-inline">{catalogCopy.pageTemplateFilesHeading}</p>
              <dl className="catalog-page__dl">
                <dt><code>{catalogCopy.pageTemplateFile1Path}</code></dt>
                <dd>{catalogCopy.pageTemplateFile1Role}</dd>
                <dt><code>{catalogCopy.pageTemplateFile2Path}</code></dt>
                <dd>{catalogCopy.pageTemplateFile2Role}</dd>
                <dt><code>{catalogCopy.pageTemplateFile3Path}</code></dt>
                <dd>{catalogCopy.pageTemplateFile3Role}</dd>
                <dt><code>{catalogCopy.pageTemplateFile4Path}</code></dt>
                <dd>{catalogCopy.pageTemplateFile4Role}</dd>
                <dt><code>{catalogCopy.pageTemplateFile5Path}</code></dt>
                <dd>{catalogCopy.pageTemplateFile5Role}</dd>
                <dt><code>{catalogCopy.pageTemplateFile6Path}</code></dt>
                <dd>{catalogCopy.pageTemplateFile6Role}</dd>
              </dl>
            </section>
            <section>
              <p className="catalog-page__subheading-inline">{catalogCopy.pageTemplateProhibitionHeading}</p>
              <p className="catalog-page__copy">{catalogCopy.pageTemplateProhibitionDetail}</p>
            </section>
            <section>
              <p className="catalog-page__subheading-inline">{catalogCopy.pageTemplateRefHeading}</p>
              <ul className="catalog-page__ref-list">
                <li><code>{catalogCopy.pageTemplateRefFile1}</code></li>
                <li><code>{catalogCopy.pageTemplateRefFile2}</code></li>
                <li><code>{catalogCopy.pageTemplateRefFile3}</code></li>
                <li><code>{catalogCopy.pageTemplateRefFile4}</code></li>
                <li><code>{catalogCopy.pageTemplateRefFile5}</code></li>
                <li><code>{catalogCopy.pageTemplateRefFile6}</code></li>
              </ul>
            </section>
          </div>
        </Card>
        <Card>
          <h2 className="catalog-page__heading">{catalogCopy.documentTemplates}</h2>
          <div className="catalog-page__stack">
            <p className="catalog-page__copy">{catalogCopy.documentInvoice1Page}</p>
            <InvoiceDocument
              issuer={sampleIssuer}
              invoiceNumber="#INV-0001"
              date="2026/08/24"
              dueDate="2026/09/07"
              registrationNumber="T3810449547408"
              billedTo={sampleBilledTo}
              shipTo={sampleShipTo}
              lines={sampleLines5}
              subtotal="\u00a5125,000"
              shippingFee="\u00a53,200"
              duty="\u00a50"
              otherFee="\u00a50"
              discount="\u00a50"
              total="\u00a5128,200"
              currency="JPY"
              notes="Sample invoice with 5 line items."
              paymentMethod="Bank Transfer"
              paymentTermsNote="Please ensure payment arrives by the due date."
            />
            <p className="catalog-page__copy">{catalogCopy.documentInvoice2Page}</p>
            <InvoiceDocument
              issuer={sampleIssuer}
              invoiceNumber="#INV-0002"
              date="2026/08/24"
              dueDate="2026/09/07"
              registrationNumber="T3810449547408"
              billedTo={sampleBilledTo}
              shipTo={sampleShipTo}
              lines={sampleLines25}
              subtotal="\u00a51,625,000"
              shippingFee="\u00a512,400"
              duty="\u00a50"
              otherFee="\u00a50"
              discount="\u00a55,000"
              total="\u00a51,632,400"
              currency="JPY"
              notes="Sample invoice spanning 2 pages (25 line items)."
              paymentMethod="Bank Transfer"
            />
            <p className="catalog-page__copy">{catalogCopy.documentInvoiceUsd}</p>
            <InvoiceDocument
              issuer={sampleIssuer}
              invoiceNumber="#INV-0003"
              date="2026/08/24"
              dueDate="2026/09/07"
              registrationNumber="T3810449547408"
              billedTo={sampleBilledTo}
              shipTo={sampleShipTo}
              lines={sampleLinesUsd}
              subtotal="$3,000.00"
              shippingFee="$48.00"
              duty="$0.00"
              otherFee="$0.00"
              discount="$0.00"
              total="$3,048.00"
              currency="USD"
              exchangeRate="1 USD = 150.00 JPY"
              notes="Sample invoice in USD with exchange rate."
              paymentMethod="Wise (E-mail transfer)"
            />
            <p className="catalog-page__copy">{catalogCopy.documentQuote}</p>
            <QuoteDocument
              issuer={sampleIssuer}
              quoteId="QT-00001"
              date="2026/08/24"
              validUntil="2026/09/23"
              registrationNumber="T3810449547408"
              customerName="SAMPLE CLIENT CO."
              lines={sampleLines5}
              subtotal="\u00a5125,000"
              shippingFee="\u00a53,200"
              discount="\u00a50"
              total="\u00a5128,200"
              currency="JPY"
              notes="Sample quotation with 5 line items."
              paymentMethod="Bank Transfer"
            />
          </div>
        </Card>
      </div>
    </>
  );
}
