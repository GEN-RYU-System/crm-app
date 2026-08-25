import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, DataTable, EmptyState, PageHeader, Skeleton, StatusMessage, Tabs, TextField, Textarea, type DataTableColumn } from '../../components/ui';
import type { CustomerRepository, DiscordCustomerInviteResult, DiscordTicketResult, PaymentProfileDto, ShippingAddressDto } from '../../features/customers/contracts';
import { customersCopy } from '../../content/ja';
import { CUSTOMER_DETAIL_TABS, CUSTOMER_PAYMENT_COLUMNS, CUSTOMER_PROFILE_FIELDS, CUSTOMER_SHIPPING_COLUMNS, customerListPath, displayCustomerProfileValue, displayPaymentValue, displayShippingValue, type CustomerDetailTab } from './customerConfig';
import { useCustomerDetailCache } from './CustomerDetailCacheContext';

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

export function CustomerDetailPage({ repository, canIssueDiscordTicket }: { repository: CustomerRepository; canIssueDiscordTicket: boolean }) {
  const navigate = useNavigate();
  const { customerId = '' } = useParams();
  const [tab, setTab] = useState<CustomerDetailTab>('basic');
  const [ticketResult, setTicketResult] = useState<DiscordTicketResult | null>(null); const [issuingTicket, setIssuingTicket] = useState(false);
  const [inviteResult, setInviteResult] = useState<DiscordCustomerInviteResult | null>(null); const [issuingInvite, setIssuingInvite] = useState(false);
  const { recordsByCustomerId, errorsByCustomerId, ensureLoaded, retry } = useCustomerDetailCache();
  const cachedRecords = recordsByCustomerId[customerId];
  const error = errorsByCustomerId[customerId];
  const customer = cachedRecords?.[0] ?? null;
  const state: LoadState = error !== undefined ? 'error' : cachedRecords === undefined ? 'loading' : customer === null ? 'missing' : 'ready';
  useEffect(() => {
    if (cachedRecords === undefined && error === undefined) void ensureLoaded(customerId);
  }, [cachedRecords, customerId, ensureLoaded, error]);
  const shippingColumns: readonly DataTableColumn<ShippingAddressDto>[] = useMemo(() => CUSTOMER_SHIPPING_COLUMNS.map((column) => ({ key: column.key, header: column.label, renderCell: (row) => displayShippingValue(row, column.key), cellAlignment: column.cellAlignment })), []);
  const paymentColumns: readonly DataTableColumn<PaymentProfileDto>[] = useMemo(() => CUSTOMER_PAYMENT_COLUMNS.map((column) => ({ key: column.key, header: column.label, renderCell: (row) => displayPaymentValue(row, column.key), cellAlignment: column.cellAlignment })), []);
  const issueDiscordTicket = useCallback(async () => { if (!customer) return; setIssuingTicket(true); setTicketResult(null); try { setTicketResult(await repository.createDiscordTicket(customer.profile.customerId)); } catch (cause) { setTicketResult({ success: false, error: cause instanceof Error ? cause.message : '' }); } finally { setIssuingTicket(false); } }, [customer, repository]);
  const issueDiscordInvite = useCallback(async () => { if (!customer) return; setIssuingInvite(true); setInviteResult(null); try { setInviteResult(await repository.createDiscordInvite(customer.profile.customerId)); } catch (cause) { setInviteResult({ success: false, error: cause instanceof Error ? cause.message : '' }); } finally { setIssuingInvite(false); } }, [customer, repository]);
  const header = <PageHeader eyebrow={customersCopy.eyebrow} title={customersCopy.detailTitle} subtitle={customersCopy.detailSubtitle} action={<Button variant="outline" onClick={() => navigate(customerListPath())}>{customersCopy.backToList}</Button>} />;
  if (state === 'loading') return <>{header}<Card><Skeleton variant="list" rows={6} label={customersCopy.detailLoading} /></Card></>;
  if (state === 'missing') return <>{header}<EmptyState title={customersCopy.detailNotFoundTitle} description={customersCopy.detailNotFoundDescription} action={<Button onClick={() => navigate(customerListPath())}>{customersCopy.backToList}</Button>} /></>;
  if (state === 'error') return <>{header}<StatusMessage variant="error">{customersCopy.detailLoadErrorPrefix} {error}<Button variant="outline" onClick={() => void retry(customerId)}>{customersCopy.retry}</Button></StatusMessage></>;
  const profile = customer!.profile;
  return <>{header}<Tabs aria-label={customersCopy.tabsLabel} items={CUSTOMER_DETAIL_TABS} activeKey={tab} onChange={setTab} variant="underline" size="md" />{tab === 'basic' && <><Card>{CUSTOMER_PROFILE_FIELDS.map((field) => field.key === 'shippingNote' ? <Textarea key={field.key} label={field.label} value={displayCustomerProfileValue(profile, field.key)} readOnly /> : <TextField key={field.key} label={field.label} value={displayCustomerProfileValue(profile, field.key)} readOnly />)}</Card>{canIssueDiscordTicket && <Card><Button onClick={() => void issueDiscordInvite()} loading={issuingInvite} loadingText={customersCopy.creatingDiscordInvite}>{customersCopy.createDiscordInvite}</Button>{inviteResult && (inviteResult.success && inviteResult.url ? <StatusMessage variant="success">{inviteResult.reused ? customersCopy.discordInviteReused(inviteResult.url) : customersCopy.discordInviteCreated(inviteResult.url)} <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(inviteResult.url!)}>{customersCopy.copyDiscordInvite}</Button></StatusMessage> : <StatusMessage variant="error">{customersCopy.discordInviteErrorPrefix} {inviteResult.error}</StatusMessage>)}</Card>}</>}{tab === 'shipping' && <Card>{customer!.shippingAddresses.length === 0 ? <EmptyState title={customersCopy.shippingEmptyTitle} description={customersCopy.shippingEmptyDescription} /> : <DataTable ariaLabel={customersCopy.shippingTableLabel} columns={shippingColumns} rows={customer!.shippingAddresses} rowKey={(row) => row.addressId} />}</Card>}{tab === 'payment' && <Card>{customer!.paymentProfiles.length === 0 ? <EmptyState title={customersCopy.paymentEmptyTitle} description={customersCopy.paymentEmptyDescription} /> : <DataTable ariaLabel={customersCopy.paymentTableLabel} columns={paymentColumns} rows={customer!.paymentProfiles} rowKey={(row) => row.paymentProfileId} />}</Card>}</>;
}
