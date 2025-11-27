import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login.jsx';
import TasksPage from './pages/Tasks.jsx';

// Simple protected route component for React Router v6
function PrivateRoute({ children }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <div className="main-content" style={{ padding: 20 }}>
        <p className="subtle">Checking authentication…</p>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function Home() {
  return (
    <main className="main-content" id="main-content">
      <div className="page-header">
        <h1 className="h1">Dashboard</h1>
        <span className="subtle">Protected area</span>
      </div>
      <div className="surface" style={{ padding: 16 }}>
        Welcome to the Enterprise Resource Management Platform.
      </div>
    </main>
  );
}

function TopNav() {
  const { logout, isAuthenticated } = useAuth();
  const location = useLocation();
  return (
    <div className="topnav">
      <div style={{ fontWeight: 700 }}>ERM Platform</div>
      <div className="actions">
        <Link
          to="/"
          className="btn ghost"
          aria-current={location.pathname === '/' ? 'page' : undefined}
        >
          Home
        </Link>
        <Link
          to="/tasks"
          className="btn ghost"
          aria-current={location.pathname.startsWith('/tasks') ? 'page' : undefined}
        >
          Tasks
        </Link>
        {isAuthenticated ? (
          <button className="btn secondary" onClick={logout}>Logout</button>
        ) : (
          <Link className="btn" to="/login">Login</Link>
        )}
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
function AppShell() {
  const [theme, setTheme] = useState('light');

  // apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="App">
      <header className="App-header" style={{ minHeight: 0, padding: 0 }}>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        <TopNav />
      </header>
      <Routes>
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <PrivateRoute>
              <TasksPage />
            </PrivateRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  /**
   * Root component that wires AuthProvider and routing shell.
   */
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
