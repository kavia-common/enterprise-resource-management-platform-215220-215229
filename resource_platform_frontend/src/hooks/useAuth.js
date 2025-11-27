import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

// PUBLIC_INTERFACE
export function useAuth() {
  /**
   * Returns authentication state and actions:
   * { token, role, isAuthenticated, loading, login, logout }
   */
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
