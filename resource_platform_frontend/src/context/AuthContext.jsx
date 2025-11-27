import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginApi, logoutApi } from '../api/auth';
import { setTokenGetter } from '../api/client';

// Storage keys
const TOKEN_KEY = 'erp_auth_token';
const ROLE_KEY = 'erp_auth_role';

// PUBLIC_INTERFACE
export const AuthContext = createContext(null);

// PUBLIC_INTERFACE
export function AuthProvider({ children }) {
  /**
   * Provides authentication state (token, role, isAuthenticated) and actions (login, logout).
   * Persists token and role to localStorage and restores on reload.
   */
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Register a token getter with the API client to attach Authorization header globally
  useEffect(() => {
    setTokenGetter(() => token);
  }, [token]);

  // Restore from storage
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedRole = localStorage.getItem(ROLE_KEY);
    if (storedToken) setToken(storedToken);
    if (storedRole) setRole(storedRole);
    setLoading(false);
  }, []);

  const login = useCallback(async ({ username, password }) => {
    const res = await loginApi({ username, password });
    // Accept flexible response shapes; prefer res.token and res.role
    const nextToken = res?.token || res?.access_token || null;
    const nextRole = res?.role || res?.user?.role || 'user';

    if (!nextToken) {
      throw new Error('Login failed: token missing in response');
    }

    setToken(nextToken);
    setRole(nextRole);

    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(ROLE_KEY, nextRole);

    return { token: nextToken, role: nextRole };
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } finally {
      setToken(null);
      setRole(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ROLE_KEY);
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      role,
      isAuthenticated: Boolean(token),
      loading,
      login,
      logout,
    }),
    [token, role, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// PUBLIC_INTERFACE
export function useAuthContext() {
  /** Access raw auth context (advanced); prefer useAuth hook for typical usage. */
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}
