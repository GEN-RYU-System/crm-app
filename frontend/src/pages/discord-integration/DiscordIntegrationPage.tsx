import { useCallback, useEffect, useState } from 'react';
import { Button, Card, PageHeader, Spinner, StatusMessage, TextField } from '../../components/ui';
import { discordIntegrationCopy } from '../../content/ja/discordIntegration';
import type { DiscordConnectionStatus, DiscordIntegrationRepository } from '../../features/discordIntegration/contracts';

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'success' | 'error';
type TestState = 'idle' | 'testing' | 'success' | 'error';
type InviteState = 'idle' | 'opening' | 'error';
type StatusCheckState = 'idle' | 'checking';

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
  const [tokenSaveState, setTokenSaveState] = useState<SaveState>('idle');
  const [tokenSaveError, setTokenSaveError] = useState('');

  const [testState, setTestState] = useState<TestState>('idle');
  const [testError, setTestError] = useState('');

  const [channels, setChannels] = useState<string[]>([]);
  const [channelInput, setChannelInput] = useState('');
  const [channelSaveState, setChannelSaveState] = useState<SaveState>('idle');
  const [channelSaveError, setChannelSaveError] = useState('');

  const [guildId, setGuildId] = useState<string | null>(null);
  const [inviteState, setInviteState] = useState<InviteState>('idle');
  const [inviteError, setInviteError] = useState('');
  const [statusCheckState, setStatusCheckState] = useState<StatusCheckState>('idle');

  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError('');
    try {
      const [status, channelsResult, oauthStatus] = await Promise.all([
        repository.getConnectionStatus(),
        repository.getChannels(),
        repository.getOAuthStatus(),
      ]);
      setConnectionStatus(status);
      setChannels(channelsResult.channels);
      setGuildId(oauthStatus.guildId);
      setLoadState('ready');
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : discordIntegrationCopy.loadError);
      setLoadState('error');
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    setTokenSaveState('saving');
    setTokenSaveError('');
    try {
      const result = await repository.saveBotToken(tokenInput.trim());
      if (result.success) {
        setTokenInput('');
        setTokenSaveState('success');
        const status = await repository.getConnectionStatus();
        setConnectionStatus(status);
      } else {
        setTokenSaveError(result.error ?? discordIntegrationCopy.tokenSaveError);
        setTokenSaveState('error');
      }
    } catch (cause) {
      setTokenSaveError(cause instanceof Error ? cause.message : discordIntegrationCopy.tokenSaveError);
      setTokenSaveState('error');
    }
  };

  const handleTestConnection = async () => {
    setTestState('testing');
    setTestError('');
    try {
      const status = await repository.getConnectionStatus();
      setConnectionStatus(status);
      setTestState(status.connected ? 'success' : 'error');
      if (!status.connected) {
        setTestError(discordIntegrationCopy.connectionFailed);
      }
    } catch (cause) {
      setTestError(cause instanceof Error ? cause.message : discordIntegrationCopy.testFailed);
      setTestState('error');
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
            onChange={(e) => { setTokenSaveState('idle'); setTokenInput(e.target.value); }}
            placeholder={discordIntegrationCopy.tokenPlaceholder}
            fullWidth
          />
          {tokenSaveState === 'success' && (
            <p role="status" style={{ color: 'var(--color-success, green)', fontSize: 'var(--font-sm)' }}>
              {discordIntegrationCopy.tokenSaved}
            </p>
          )}
          {tokenSaveState === 'error' && (
            <StatusMessage variant="error">{tokenSaveError || discordIntegrationCopy.tokenSaveError}</StatusMessage>
          )}
          <div>
            <Button
              variant="primary"
              onClick={() => void handleSaveToken()}
              loading={tokenSaveState === 'saving'}
              loadingText={discordIntegrationCopy.savingToken}
              disabled={!tokenInput.trim()}
            >
              {discordIntegrationCopy.saveToken}
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
          {testState === 'error' && (
            <StatusMessage variant="error">{testError}</StatusMessage>
          )}
          {testState === 'success' && (
            <p role="status" style={{ color: 'var(--color-success, green)', fontSize: 'var(--font-sm)' }}>
              {discordIntegrationCopy.connectionSuccess}
            </p>
          )}
          <div>
            <Button
              variant="outline"
              onClick={() => void handleTestConnection()}
              loading={testState === 'testing'}
              loadingText={discordIntegrationCopy.testingConnection}
              disabled={!connectionStatus.isTokenSet}
            >
              {discordIntegrationCopy.testConnection}
            </Button>
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
    </>
  );
}
