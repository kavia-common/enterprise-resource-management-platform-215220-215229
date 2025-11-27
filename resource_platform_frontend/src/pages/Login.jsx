import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getApiBaseUrl } from '../api/client';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(17,24,39,0.15)',
  marginBottom: '10px',
};

const cardStyle = {
  maxWidth: 380,
  width: '100%',
  margin: '0 auto',
  padding: 24,
  borderRadius: '14px',
  background: 'var(--color-surface)',
  boxShadow: 'var(--shadow-md)',
  border: '1px solid rgba(17,24,39,0.08)',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  // Compute base URL for banner guidance
  const apiBase = useMemo(() => getApiBaseUrl(), []);

  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPending(true);
    try {
      await login(form);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message || 'Login failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="main-content" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <section style={cardStyle} aria-labelledby="login-title">
        <h1 id="login-title" className="h1" style={{ marginBottom: 6 }}>Sign in</h1>
        <p className="subtle" style={{ marginTop: 0, marginBottom: 16 }}>Access your resource management dashboard</p>
        {error ? (
          <div
            role="alert"
            style={{
              padding: '10px 12px',
              marginBottom: 12,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.08)',
              color: 'var(--color-error)',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            {error}
          </div>
        ) : null}

        {/* Backend reachability guidance banner (shown only when network/auth errors happen) */}
        <div
          className="surface"
          style={{
            padding: '10px 12px',
            marginBottom: 12,
            borderRadius: 8,
            background: 'rgba(37,99,235,0.06)',
            border: '1px solid rgba(37,99,235,0.2)',
            color: 'var(--color-text)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Tip</div>
          <div className="subtle" style={{ margin: 0 }}>
            If sign-in fails due to a network or CORS error, ensure the backend is running and that
            REACT_APP_API_BASE is set. Current API base: <code>{apiBase || 'not set'}</code>
          </div>
        </div>
        <form onSubmit={onSubmit}>
          <label htmlFor="username" className="subtle">Username</label>
          <input
            id="username"
            name="username"
            value={form.username}
            onChange={onChange}
            style={inputStyle}
            placeholder="Enter your username"
            autoComplete="username"
            required
          />
          <label htmlFor="password" className="subtle">Password</label>
          <input
            id="password"
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            style={inputStyle}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
          <button className="btn" type="submit" disabled={pending} style={{ width: '100%', marginTop: 8 }}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
