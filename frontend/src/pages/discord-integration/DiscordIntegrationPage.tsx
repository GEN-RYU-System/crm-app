import { useCallback, useEffect, useState } from 'react';
import { Button, Card, PageHeader, Spinner, StatusMessage, TextField } from '../../components/ui';
import { discordIntegrationCopy } from '../../content/ja/discordIntegration';
import type { DiscordConnectionStatus, DiscordIntegrationRepository, DiscordSetupStatus } from '../../features/discordIntegration/contracts';

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'success' | 'error';
type TokenConnectionState = 'idle' | 'saving' | 'connected' | 'connection-error' | 'save-error';
type InviteState = 'idle' | 'opening' | 'error';
type StatusCheckState = 'idle' | 'checking';
type SetupState = 'idle' | 'running' | 'success' | 'error';

type Props = {
  repository: DiscordIntegrationRepository;
};

export function DiscordIntegrationPage({ repository }: Props) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<DiscordConnectionStatus>({
    isTokenSet: false,
    tokenMask: discordIntegrationCopy.notSet,
    botName: '',
    botId: '',
    connected: false,
  });

  const [tokenInput, setTokenInput] = useState('');
  const [tokenConnectionState, setTokenConnectionState] = useState<TokenConnectionState>('idle');
  const [tokenSaveError, setTokenSaveError] = useState('');

  const [channels, setChannels] = useState<string[]>([]);
  const [channelInput, setChannelInput] = useState('');
  const [channelSaveState, setChannelSaveState] = useState<SaveState>('idle');
  const [channelSaveError, setChannelSaveError] = useState('');

  const [guildId, setGuildId] = useState<string | null>(null);
  const [inviteState, setInviteState] = useState<InviteState>('idle');
  const [inviteError, setInviteError] = useState('');
  const [statusCheckState, setStatusCheckState] = useState<StatusCheckState>('idle');

  const [setupStatus, setSetupStatus] = useState<DiscordSetupStatus>({ guildId: null, categoryId: null, ticketChannelId: null });
  const [setupState, setSetupState] = useState<SetupState>('idle');
  const [setupError, setSetupError] = useState('');
  const [setupResult, setSetupResult] = useState<{ categoryId: string; ticketChannelId: string } | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError('');
    try {
      const [status, channelsResult, oauthStatus, setupStatusResult] = await Promise.all([
        repository.getConnectionStatus(),
        repository.getChannels(),
        repository.getOAuthStatus(),
        repository.getSetupStatus(),
      ]);
      setConnectionStatus(status);
      setChannels(channelsResult.channels);
      setGuildId(oauthStatus.guildId);
      setSetupStatus(setupStatusResult);
      setLoadState('ready');
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : discordIntegrationCopy.loadError);
      setLoadState('error');
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    setTokenConnectionState('saving');
    setTokenSaveError('');
    try {
      const result = await repository.saveBotToken(tokenInput.trim());
      if (result.success) {
        setTokenInput('');
        const status = await repository.getConnectionStatus();
        setConnectionStatus(status);
        if (status.connected) {
          setTokenConnectionState('connected');
        } else {
          setTokenConnectionState('connection-error');
        }
      } else {
        setTokenSaveError(result.error ?? discordIntegrationCopy.tokenSaveError);
        setTokenConnectionState('save-error');
      }
    } catch (cause) {
      setTokenSaveError(cause instanceof Error ? cause.message : discordIntegrationCopy.tokenSaveError);
      setTokenConnectionState('save-error');
    }
  };

  const handleAddChannel = async () => {
    const trimmed = channelInput.trim();
    if (!trimmed) return;
    if (channels.includes(trimmed)) {
      setChannelSaveError(discordIntegrationCopy.channelDuplicate);
      setChannelSaveState('error');
      return;
    }
    const nextChannels = [...channels, trimmed];
    setChannelSaveState('saving');
    setChannelSaveError('');
    try {
      const result = await repository.saveChannels(nextChannels);
      if (result.success) {
        setChannels(nextChannels);
        setChannelInput('');
        setChannelSaveState('success');
      } else {
        setChannelSaveError(result.error ?? discordIntegrationCopy.channelAddError);
        setChannelSaveState('error');
      }
    } catch (cause) {
      setChannelSaveError(cause instanceof Error ? cause.message : discordIntegrationCopy.channelAddError);
      setChannelSaveState('error');
    }
  };

  const handleInviteBot = async () => {
    setInviteState('opening');
    setInviteError('');
    try {
      const result = await repository.generateOAuthUrl();
      if (result.success && result.url) {
        window.open(result.url, '_blank');
        setInviteState('idle');
      } else {
        const errorMsg = result.error === 'CLIENT_ID_NOT_SET'
          ? discordIntegrationCopy.clientIdNotSet
          : (result.error ?? discordIntegrationCopy.inviteError);
        setInviteError(errorMsg);
        setInviteState('error');
      }
    } catch (cause) {
      setInviteError(cause instanceof Error ? cause.message : discordIntegrationCopy.inviteError);
      setInviteState('error');
    }
  };

  const handleRefreshOAuthStatus = async () => {
    setStatusCheckState('checking');
    try {
      const result = await repository.getOAuthStatus();
      setGuildId(result.guildId);
    } finally {
      setStatusCheckState('idle');
    }
  };

  const handleRemoveChannel = async (channelId: string) => {
    const nextChannels = channels.filter((c) => c !== channelId);
    setChannelSaveState('saving');
    setChannelSaveError('');
    try {
      const result = await repository.saveChannels(nextChannels);
      if (result.success) {
        setChannels(nextChannels);
        setChannelSaveState('idle');
      } else {
        setChannelSaveError(result.error ?? discordIntegrationCopy.channelAddError);
        setChannelSaveState('error');
      }
    } catch (cause) {
      setChannelSaveError(cause instanceof Error ? cause.message : discordIntegrationCopy.channelAddError);
      setChannelSaveState('error');
    }
  };

  const handleRunSetup = async () => {
    setSetupState('running');
    setSetupError('');
    setSetupResult(null);
    try {
      const result = await repository.runAutoSetup();
      if (result.success && result.categoryId && result.ticketChannelId) {
        setSetupState('success');
        setSetupResult({ categoryId: result.categoryId, ticketChannelId: result.ticketChannelId });
        const nextStatus = await repository.getSetupStatus();
        setSetupStatus(nextStatus);
      } else {
        setSetupError(result.error ?? discordIntegrationCopy.setupError);
        setSetupState('error');
      }
    } catch (cause) {
      setSetupError(cause instanceof Error ? cause.message : discordIntegrationCopy.setupError);
      setSetupState('error');
    }
  };

  if (loadState === 'loading') {
    return (
      <>
        <PageHeader title={discordIntegrationCopy.title} subtitle={discordIntegrationCopy.subtitle} />
        <StatusMessage variant="loading">
          <Spinner size="sm" aria-label={discordIntegrationCopy.loading} />
          {discordIntegrationCopy.loading}
        </StatusMessage>
      </>
    );
  }

  if (loadState === 'error') {
    return (
      <>
        <PageHeader title={discordIntegrationCopy.title} subtitle={discordIntegrationCopy.subtitle} />
        <StatusMessage variant="error">
          {loadError || discordIntegrationCopy.loadError}
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {discordIntegrationCopy.retry}
          </Button>
        </StatusMessage>
      </>
    );
  }

  return (
    <>
      <PageHeader title={discordIntegrationCopy.title} subtitle={discordIntegrationCopy.subtitle} />

      <Card>
        <h2 style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--font-md)', fontWeight: 600 }}>
          {discordIntegrationCopy.tokenSection}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <TextField
            label={discordIntegrationCopy.tokenLabel}
            type="password"
            value={tokenInput}
            onChange={(e) => { setTokenConnectionState('idle'); setTokenInput(e.target.value); }}
            placeholder={discordIntegrationCopy.tokenPlaceholder}
            fullWidth
          />
          {tokenConnectionState === 'connected' && (
            <StatusMessage variant="success">
              {discordIntegrationCopy.saveAndConnectSuccess} {discordIntegrationCopy.connectedBot}{connectionStatus.botName} (ID: {connectionStatus.botId})
            </StatusMessage>
          )}
          {tokenConnectionState === 'connection-error' && (
            <StatusMessage variant="error">{discordIntegrationCopy.savedButConnectionFailed}</StatusMessage>
          )}
          {tokenConnectionState === 'save-error' && (
            <StatusMessage variant="error">{tokenSaveError || discordIntegrationCopy.tokenSaveError}</StatusMessage>
          )}
          <div>
            <Button
              variant="primary"
              onClick={() => void handleSaveToken()}
              loading={tokenConnectionState === 'saving'}
              loadingText={discordIntegrationCopy.savingAndTesting}
              disabled={!tokenInput.trim()}
            >
              {discordIntegrationCopy.saveAndConnect}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--font-md)', fontWeight: 600 }}>
          {discordIntegrationCopy.connectionSection}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ fontSize: 'var(--font-sm)' }}>
            {connectionStatus.isTokenSet ? (
              <>
                <p>
                  <span style={{ fontWeight: 600 }}>{discordIntegrationCopy.tokenLabelPrefix}</span>
                  <code>{connectionStatus.tokenMask}</code>
                </p>
                {connectionStatus.connected ? (
                  <p style={{ color: 'var(--color-success, green)' }}>
                    {discordIntegrationCopy.connectionStatus.connected} &mdash; {discordIntegrationCopy.connectedBot}{connectionStatus.botName} (ID: {connectionStatus.botId})
                  </p>
                ) : (
                  <p style={{ color: 'var(--color-danger)' }}>
                    {discordIntegrationCopy.connectionStatus.notConnected}
                  </p>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--color-text-muted, gray)' }}>
                {discordIntegrationCopy.connectionStatus.notSet}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h2 style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--font-md)', fontWeight: 600 }}>
          {discordIntegrationCopy.channelSection}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
            <TextField
              label={discordIntegrationCopy.channelIdLabel}
              value={channelInput}
              onChange={(e) => { setChannelSaveState('idle'); setChannelInput(e.target.value); }}
              placeholder={discordIntegrationCopy.channelIdPlaceholder}
              fullWidth
            />
            <Button
              variant="primary"
              onClick={() => void handleAddChannel()}
              loading={channelSaveState === 'saving'}
              loadingText={discordIntegrationCopy.addingChannel}
              disabled={!channelInput.trim()}
            >
              {discordIntegrationCopy.addChannel}
            </Button>
          </div>
          {channelSaveState === 'success' && (
            <p role="status" style={{ color: 'var(--color-success, green)', fontSize: 'var(--font-sm)' }}>
              {discordIntegrationCopy.channelAdded}
            </p>
          )}
          {channelSaveState === 'error' && (
            <StatusMessage variant="error">{channelSaveError || discordIntegrationCopy.channelAddError}</StatusMessage>
          )}
          <div>
            {channels.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted, gray)', fontSize: 'var(--font-sm)' }}>
                {discordIntegrationCopy.noChannels}
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {channels.map((channelId) => (
                  <li
                    key={channelId}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-sm)', background: 'var(--color-surface-subtle, #f5f5f5)', borderRadius: 'var(--radius-control)' }}
                  >
                    <code style={{ fontSize: 'var(--font-sm)' }}>{channelId}</code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRemoveChannel(channelId)}
                    >
                      {discordIntegrationCopy.removeChannel}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h2 style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--font-md)', fontWeight: 600 }}>
          {discordIntegrationCopy.inviteSection}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-muted, gray)' }}>
            {discordIntegrationCopy.inviteDescription}
          </p>
          <div style={{ fontSize: 'var(--font-sm)' }}>
            {guildId ? (
              <p style={{ color: 'var(--color-success, green)', fontWeight: 500 }}>
                {discordIntegrationCopy.guildLinked}{guildId})
              </p>
            ) : (
              <p style={{ color: 'var(--color-text-muted, gray)' }}>
                {discordIntegrationCopy.guildNotLinked}
              </p>
            )}
          </div>
          {inviteState === 'error' && (
            <StatusMessage variant="error">{inviteError}</StatusMessage>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              onClick={() => void handleInviteBot()}
              loading={inviteState === 'opening'}
              loadingText={discordIntegrationCopy.invitingBot}
            >
              {discordIntegrationCopy.inviteButton}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleRefreshOAuthStatus()}
              loading={statusCheckState === 'checking'}
              loadingText={discordIntegrationCopy.refreshingStatus}
            >
              {discordIntegrationCopy.refreshStatus}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--font-md)', fontWeight: 600 }}>
          {discordIntegrationCopy.setupSection}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ fontSize: 'var(--font-sm)' }}>
            {setupStatus.categoryId && setupStatus.ticketChannelId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                <p style={{ color: 'var(--color-success, green)', fontWeight: 600 }}>
                  {discordIntegrationCopy.setupStatusDone}
                </p>
                <p>
                  <span style={{ fontWeight: 600 }}>{discordIntegrationCopy.setupCategoryLabel}: </span>
                  <code>{setupStatus.categoryId}</code>
                </p>
                <p>
                  <span style={{ fontWeight: 600 }}>{discordIntegrationCopy.setupTicketLabel}: </span>
                  <code>{setupStatus.ticketChannelId}</code>
                </p>
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted, gray)' }}>
                {discordIntegrationCopy.setupStatusNotDone}
              </p>
            )}
          </div>
          {setupState === 'success' && setupResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <p role="status" style={{ color: 'var(--color-success, green)', fontSize: 'var(--font-sm)', fontWeight: 600 }}>
                {discordIntegrationCopy.setupSuccess}
              </p>
              <p style={{ fontSize: 'var(--font-sm)' }}>
                <span style={{ fontWeight: 600 }}>{discordIntegrationCopy.setupCategoryLabel}: </span>
                <code>{setupResult.categoryId}</code>
              </p>
              <p style={{ fontSize: 'var(--font-sm)' }}>
                <span style={{ fontWeight: 600 }}>{discordIntegrationCopy.setupTicketLabel}: </span>
                <code>{setupResult.ticketChannelId}</code>
              </p>
            </div>
          )}
          {setupState === 'error' && (
            <StatusMessage variant="error">{setupError || discordIntegrationCopy.setupError}</StatusMessage>
          )}
          <div>
            <Button
              variant="primary"
              onClick={() => void handleRunSetup()}
              loading={setupState === 'running'}
              loadingText={discordIntegrationCopy.setupButtonRunning}
              disabled={!setupStatus.guildId}
              title={!setupStatus.guildId ? discordIntegrationCopy.setupDisabledReason : undefined}
            >
              {discordIntegrationCopy.setupButton}
            </Button>
          </div>
          {!setupStatus.guildId && (
            <p style={{ color: 'var(--color-text-muted, gray)', fontSize: 'var(--font-sm)' }}>
              {discordIntegrationCopy.setupDisabledReason}
            </p>
          )}
        </div>
      </Card>
    </>
  );
}
