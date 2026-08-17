import { type FormEvent, useState } from 'react';
import { authCopy } from '../../content/ja/auth';
import { useAuth } from '../../contexts/AuthContext';
import './LoginPage.css';

export function LoginPage() {
  const { login } = useAuth();
  const [staffId, setStaffId]     = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(staffId.trim(), password);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (message.startsWith('LOGIN_LOCKED')) {
        const sep = message.indexOf(': ');
        setError(sep !== -1 ? message.slice(sep + 2) : message);
      } else {
        setError(authCopy.loginFailed);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__card">
        <div className="login-page__brand" aria-hidden="true">CRM</div>
        <h1 className="login-page__title">{authCopy.loginTitle}</h1>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="login-page__fields">
            <div className="ui-field">
              <label className="ui-field__label" htmlFor="login-staff-id">
                {authCopy.staffIdLabel}
              </label>
              <input
                id="login-staff-id"
                className="ui-field__control"
                type="text"
                placeholder={authCopy.staffIdPlaceholder}
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                autoComplete="username"
                disabled={submitting}
                required
              />
            </div>

            <div className="ui-field">
              <label className="ui-field__label" htmlFor="login-password">
                {authCopy.passwordLabel}
              </label>
              <input
                id="login-password"
                className="ui-field__control"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={submitting}
                required
              />
            </div>
          </div>

          {error && (
            <p className="login-page__error" role="alert">{error}</p>
          )}

          <button
            type="submit"
            className="login-page__submit"
            disabled={submitting || !staffId.trim() || !password}
          >
            {submitting ? authCopy.loggingIn : authCopy.loginButton}
          </button>
        </form>
      </div>
    </div>
  );
}
