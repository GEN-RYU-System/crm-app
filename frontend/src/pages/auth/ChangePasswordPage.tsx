import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, PageHeader } from '../../components/ui';
import { authCopy } from '../../content/ja/auth';
import { changeOwnPasswordForFrontend } from '../../gas/client';
import { NAVIGATION_BY_ID } from '../../app/navigation';
import './ChangePasswordPage.css';

const MIN_PASSWORD_LENGTH = 12;

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPw.length < MIN_PASSWORD_LENGTH) {
      setError(authCopy.passwordTooShort);
      return;
    }
    if (newPw !== confirmPw) {
      setError(authCopy.confirmMismatch);
      return;
    }
    if (newPw === currentPw) {
      setError(authCopy.passwordUnchanged);
      return;
    }

    setSubmitting(true);
    try {
      await changeOwnPasswordForFrontend(currentPw, newPw);
      setSuccess(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (message.startsWith('PASSWORD_MISMATCH'))    setError(authCopy.passwordMismatch);
      else if (message.startsWith('PASSWORD_TOO_SHORT'))  setError(authCopy.passwordTooShort);
      else if (message.startsWith('PASSWORD_UNCHANGED'))  setError(authCopy.passwordUnchanged);
      else setError(message || authCopy.passwordMismatch);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <>
        <PageHeader title={authCopy.changePasswordTitle} />
        <Card>
          <div className="change-password-page__success">
            <p className="change-password-page__success-message">{authCopy.changeSuccess}</p>
            <Button
              variant="primary"
              onClick={() => navigate(NAVIGATION_BY_ID.dashboard.hash)}
            >
              {authCopy.backToDashboard}
            </Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={authCopy.changePasswordTitle} />
      <Card>
        <form
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className="change-password-page__form"
        >
          <div className="ui-field">
            <label className="ui-field__label" htmlFor="cp-current">
              {authCopy.currentPasswordLabel}
            </label>
            <input
              id="cp-current"
              className="ui-field__control"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              required
            />
          </div>

          <div className="ui-field">
            <label className="ui-field__label" htmlFor="cp-new">
              {authCopy.newPasswordLabel}
            </label>
            <input
              id="cp-new"
              className="ui-field__control"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              disabled={submitting}
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>

          <div className="ui-field">
            <label className="ui-field__label" htmlFor="cp-confirm">
              {authCopy.confirmPasswordLabel}
            </label>
            <input
              id="cp-confirm"
              className="ui-field__control"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              disabled={submitting}
              required
            />
          </div>

          {error && (
            <p className="change-password-page__error" role="alert">{error}</p>
          )}

          <div className="change-password-page__actions">
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !currentPw || !newPw || !confirmPw}
            >
              {submitting ? authCopy.changing : authCopy.changePasswordButton}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
