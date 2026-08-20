import { useState } from "react";
import { CRM_NAV_ICONS, CRM_SORT_ICONS } from "../../app/icons";
import {
  Badge,
  Button,
  Card,
  Combobox,
  ConversationWorkspace,
  DataTable,
  EmptyState,
  HubShell,
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
  type DataTableColumn,
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
          <h2 className="catalog-page__heading">{catalogCopy.pagePattern.heading}</h2>
          <div className="catalog-page__stack">
            <section>
              <h3 className="catalog-page__subheading">{catalogCopy.pagePattern.filesHeading}</h3>
              <table className="catalog-page__pattern-table">
                <thead>
                  <tr>
                    <th>{catalogCopy.pagePattern.colFile}</th>
                    <th>{catalogCopy.pagePattern.colRole}</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogCopy.pagePattern.files.map((item) => (
                    <tr key={item.path}>
                      <td><code>{item.path}</code></td>
                      <td>{item.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              <h3 className="catalog-page__subheading">{catalogCopy.pagePattern.prohibitionHeading}</h3>
              <StatusMessage variant="error">{catalogCopy.pagePattern.prohibition}</StatusMessage>
              <p className="catalog-page__copy">{catalogCopy.pagePattern.prohibitionNote}</p>
            </section>
            <section>
              <h3 className="catalog-page__subheading">{catalogCopy.pagePattern.exampleHeading}</h3>
              <table className="catalog-page__pattern-table">
                <tbody>
                  {catalogCopy.pagePattern.exampleFiles.map((path) => (
                    <tr key={path}>
                      <td><code>{path}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </Card>
      </div>
    </>
  );
}
