//
// Authentication API wrapper
// These functions call the backend auth endpoints. Responses are expected
// to contain a token and optional role; adjust to backend contract as needed.
//

import { api } from './client';

// PUBLIC_INTERFACE
export async function loginApi({ username, password }) {
  /**
   * POST /auth/login
   * Expected backend response example:
   * { token: "jwt-token", role: "admin" }
   */
  const res = await api.post('/auth/login', { username, password });
  return res;
}

// PUBLIC_INTERFACE
export async function logoutApi() {
  /**
   * POST /auth/logout
   * If backend doesn't require body, just call empty.
   * We ignore response body. Errors will bubble up.
   */
  try {
    await api.post('/auth/logout', {});
  } catch (e) {
    // Best-effort logout; not fatal if backend doesn't support logout
  }
}
