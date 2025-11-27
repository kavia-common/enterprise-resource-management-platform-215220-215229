import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
// If Dashboard and other pages exist, import them; fallback to Login for unknown paths
import Dashboard from '../pages/Dashboard';

/**
 * PUBLIC_INTERFACE
 * Application router registering core routes, including Signup.
 * Consumers can import and render <AppRouter /> at the app entry.
 */
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* Example route for dashboard; adjust to actual component */}
        <Route path="/dashboard" element={<Dashboard />} />
        {/* Fallback */}
        <Route path="*" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}
