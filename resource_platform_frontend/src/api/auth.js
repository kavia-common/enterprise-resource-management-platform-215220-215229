//
// Authentication API wrapper
// These functions call the backend auth endpoints. Responses are expected
// to contain a token and optional role; adjust to backend contract as needed.
//

import { api } from './client';

// PUBLIC_INTERFACE
export async function loginApi({ username, password, email }) {
  /**
   * POST /api/auth/login
   * Backend expects { email, password } per OpenAPI. Map username to email for demo UX.
   * Returns: { token, user }
   */
  const payload = { email: email || username, password };
  const res = await api.post('/api/auth/login', payload);
  return res;
}

// PUBLIC_INTERFACE
export async function logoutApi() {
  /**
   * POST /api/auth/logout
   * Backend accepts token via Authorization header (client attaches automatically).
   */
  try {
    await api.post('/api/auth/logout', {});
  } catch (_e) {
    // non-fatal
  }
}
