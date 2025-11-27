/**
 * Auth API helpers
 * Exposes: signup, loginApi, logoutApi
 * Uses environment discovery similar to other api modules.
 */

// PUBLIC_INTERFACE
export async function signup({ name, email, password }) {
  /** Sign up via backend endpoint and return the response JSON. */
  const apiBase =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    "";

  const res = await fetch(`${stripTrailingSlash(apiBase)}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    let msg = "Failed to sign up";
    try {
      const data = await res.json();
      msg = data?.detail || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}

// PUBLIC_INTERFACE
export async function loginApi(credentials) {
  /**
   * Login with either { email, password } or { username, password }.
   * Aligns with backend which expects email/password per OpenAPI.
   * Returns normalized { token, role, user } to match AuthContext consumption.
   */
  const { email, username, password } = credentials || {};
  const apiBase =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    "";

  const payload = {
    // backend expects email; map username->email if provided by UI
    email: email || username,
    password,
  };

  const res = await fetch(`${stripTrailingSlash(apiBase)}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "Failed to login";
    try {
      const data = await res.json();
      msg = data?.detail || data?.message || msg;
    } catch {
      // ignore
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  // Normalize return for AuthContext expectations
  // Backend returns { token, user: { role, ... } }
  const token = data?.token || data?.access_token || null;
  const role = data?.user?.role || data?.role || "user";
  return { token, role, user: data?.user || null };
}

// PUBLIC_INTERFACE
export async function logoutApi() {
  /**
   * Logout endpoint. If backend is unreachable or returns non-200,
   * treat it as best-effort and still resolve (AuthContext clears locally).
   */
  const apiBase =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    "";

  try {
    const res = await fetch(`${stripTrailingSlash(apiBase)}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    // For robustness, don't throw on non-OK; consumers clear client state anyway.
    if (!res.ok) {
      // Try to parse for logging (ignored here)
      await res.text().catch(() => null);
    }
  } catch (_e) {
    // Network errors are ignored as logout is best-effort.
  }
  return { success: true };
}

function stripTrailingSlash(s) {
  return String(s || "").replace(/\/+$/, "");
}
