import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { gasLogout, getSessionUser, loginWithPassword, type SessionUser } from '../gas/client';

const SESSION_KEY = 'crm_session_id';

function readStoredSessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionId(sessionId: string): void {
  try { sessionStorage.setItem(SESSION_KEY, sessionId); } catch { /* ignore */ }
  try { localStorage.setItem(SESSION_KEY, sessionId); } catch { /* ignore */ }
}

function clearSessionId(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

type AuthState =
  | { status: 'checking' }
  | { status: 'authenticated'; sessionId: string; user: SessionUser }
  | { status: 'unauthenticated' };

type AuthContextValue = {
  state: AuthState;
  login: (staffId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ status: 'checking' });

  useEffect(() => {
    const sessionId = readStoredSessionId();
    if (!sessionId) {
      setState({ status: 'unauthenticated' });
      return;
    }
    void getSessionUser(sessionId)
      .then((user) => {
        if (user) {
          setState({ status: 'authenticated', sessionId, user });
        } else {
          clearSessionId();
          setState({ status: 'unauthenticated' });
        }
      })
      .catch(() => {
        clearSessionId();
        setState({ status: 'unauthenticated' });
      });
  }, []);

  const login = useCallback(async (staffId: string, password: string) => {
    const result = await loginWithPassword(staffId, password);
    writeSessionId(result.sessionId);
    setState({
      status: 'authenticated',
      sessionId: result.sessionId,
      user: {
        staffId:    result.staffId,
        fullNameJa: result.fullNameJa,
        role:       result.role,
        email:      '',
      },
    });
  }, []);

  const logout = useCallback(async () => {
    const sessionId = state.status === 'authenticated' ? state.sessionId : null;
    clearSessionId();
    setState({ status: 'unauthenticated' });
    if (sessionId) {
      try { await gasLogout(sessionId); } catch { /* ignore */ }
    }
  }, [state]);

  return (
    <AuthContext.Provider value={{ state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
