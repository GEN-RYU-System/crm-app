import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, PageHeader, Spinner, StatusMessage, TextField } from '../../components/ui';
import { DRIVE_FOLDER_KEYS, driveCopy } from '../../content/ja/drive';
import { driveGasRepository } from '../../features/drive/gasAdapter';
import type { DriveFolderSettings } from '../../features/drive/contracts';

type FolderKey = typeof DRIVE_FOLDER_KEYS[keyof typeof DRIVE_FOLDER_KEYS];

type FolderItem = {
  key: FolderKey;
  label: string;
};

const FOLDER_ITEMS: readonly FolderItem[] = [
  { key: DRIVE_FOLDER_KEYS.quote, label: driveCopy.quoteFolder },
  { key: DRIVE_FOLDER_KEYS.invoice, label: driveCopy.invoiceFolder },
  { key: DRIVE_FOLDER_KEYS.shipping, label: driveCopy.shippingFolder },
  { key: DRIVE_FOLDER_KEYS.purchase, label: driveCopy.purchaseFolder },
];

type RowSaveState = 'idle' | 'saving' | 'error';

export function DriveFolderPage() {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [settings, setSettings] = useState<DriveFolderSettings>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [rowStates, setRowStates] = useState<Record<string, RowSaveState>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError('');
    try {
      const data = await driveGasRepository.getFolders();
      setSettings(data);
      setInputs(Object.fromEntries(FOLDER_ITEMS.map(({ key }) => [key, data[key] ?? ''])));
      setRowStates(Object.fromEntries(FOLDER_ITEMS.map(({ key }) => [key, 'idle'])));
      setRowErrors(Object.fromEntries(FOLDER_ITEMS.map(({ key }) => [key, ''])));
      setLoadState('ready');
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : driveCopy.loadError);
      setLoadState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleInputChange = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputs((prev) => ({ ...prev, [key]: event.target.value }));
    setRowStates((prev) => ({ ...prev, [key]: 'idle' }));
    setRowErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSave = (key: string) => async () => {
    setRowStates((prev) => ({ ...prev, [key]: 'saving' }));
    setRowErrors((prev) => ({ ...prev, [key]: '' }));
    try {
      await driveGasRepository.updateFolder(key, inputs[key] ?? '');
      setSettings((prev) => ({ ...prev, [key]: inputs[key] ?? '' }));
      setRowStates((prev) => ({ ...prev, [key]: 'idle' }));
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : driveCopy.errorNotFound;
      const displayMsg = msg.includes('DRIVE_FOLDER_NOT_EDITABLE') ? driveCopy.errorNoPermission
        : msg.includes('DRIVE_FOLDER_NOT_ACCESSIBLE') || msg.includes('DRIVE_FOLDER_ID_INVALID') ? driveCopy.errorNotFound
        : msg;
      setRowErrors((prev) => ({ ...prev, [key]: displayMsg }));
      setRowStates((prev) => ({ ...prev, [key]: 'error' }));
    }
  };

  const handleDelete = (key: string) => async () => {
    setRowStates((prev) => ({ ...prev, [key]: 'saving' }));
    setRowErrors((prev) => ({ ...prev, [key]: '' }));
    try {
      await driveGasRepository.updateFolder(key, '');
      setSettings((prev) => ({ ...prev, [key]: '' }));
      setInputs((prev) => ({ ...prev, [key]: '' }));
      setRowStates((prev) => ({ ...prev, [key]: 'idle' }));
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : driveCopy.errorNotFound;
      setRowErrors((prev) => ({ ...prev, [key]: msg }));
      setRowStates((prev) => ({ ...prev, [key]: 'error' }));
    }
  };

  const isLoading = loadState === 'loading';

  return (
    <>
      <PageHeader title={driveCopy.title} subtitle={driveCopy.subtitle} />
      <Card>
        {isLoading && (
          <StatusMessage variant="loading">
            <Spinner size="sm" aria-label={driveCopy.loading} />
            {driveCopy.loading}
          </StatusMessage>
        )}
        {loadState === 'error' && (
          <StatusMessage variant="error">
            {loadError || driveCopy.loadError}
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {driveCopy.retry}
            </Button>
          </StatusMessage>
        )}
        {loadState === 'ready' && (
          <div>
            {FOLDER_ITEMS.map(({ key, label }) => {
              const currentValue = settings[key] ?? '';
              const isRegistered = currentValue !== '';
              const inputValue = inputs[key] ?? '';
              const rowState = rowStates[key] ?? 'idle';
              const rowError = rowErrors[key] ?? '';
              const isSaving = rowState === 'saving';
              return (
                <div key={key} style={{ marginBottom: 'var(--spacing-6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
                    <span>{label}</span>
                    <Badge variant={isRegistered ? 'success' : 'neutral'}>
                      {isRegistered ? driveCopy.registered : driveCopy.notRegistered}
                    </Badge>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'flex-end' }}>
                    <TextField
                      label={label}
                      value={inputValue}
                      onChange={handleInputChange(key)}
                      placeholder={driveCopy.placeholder}
                      fullWidth
                      disabled={isSaving}
                    />
                    {isRegistered ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleSave(key)()}
                          loading={isSaving}
                          loadingText={driveCopy.saving}
                          disabled={inputValue === currentValue}
                        >
                          {driveCopy.change}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void handleDelete(key)()}
                          loading={isSaving}
                          loadingText={driveCopy.saving}
                        >
                          {driveCopy.delete}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void handleSave(key)()}
                        loading={isSaving}
                        loadingText={driveCopy.saving}
                        disabled={inputValue === ''}
                      >
                        {driveCopy.register}
                      </Button>
                    )}
                  </div>
                  {rowState === 'error' && rowError && (
                    <StatusMessage variant="error">{rowError}</StatusMessage>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
