//
// Lightweight API client for the React frontend
//
// Reads base URL from REACT_APP_API_BASE (fallbacks provided) and
// exposes helper methods for HTTP verbs. Authorization header is attached
// by reading the current token via a getter function provided by the AuthContext.
//

// PUBLIC_INTERFACE
export function getApiBaseUrl() {
  /**
   * Discover the API base URL from environment variables.
   * Priority:
   * - REACT_APP_API_BASE
   * - REACT_APP_BACKEND_URL
   * - window.location.origin (same-origin fallback)
   */
  const envBase =
    process.env.REACT_APP_API_BASE ||
    process.env.REACT_APP_BACKEND_URL ||
    '';

  // Ensure no trailing slash to avoid double slashes with path joins
  return envBase.replace(/\/+$/, '');
}

// A module-level getter to retrieve the current auth token from context without causing circular imports.
// The AuthContext will register a getter via setTokenGetter during app bootstrap.
let tokenGetter = null;

// PUBLIC_INTERFACE
export function setTokenGetter(getterFn) {
  /** Register a token getter function provided by the AuthContext. */
  tokenGetter = typeof getterFn === 'function' ? getterFn : null;
}

async function request(path, { method = 'GET', headers = {}, body, query } = {}) {
  const base = getApiBaseUrl();
  const url = buildUrl(`${base}${normalizePath(path)}`, query);

  const token = tokenGetter ? tokenGetter() : null;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const finalHeaders = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...headers,
  };

  const options = {
    method,
    headers: finalHeaders,
  };
  if (body !== undefined && body !== null) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    // Network level error
    const error = new Error('Network error while contacting API');
    error.cause = err;
    error.isNetworkError = true;
    throw error;
  }

  // Try to parse JSON if available
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await safeJson(response) : await response.text();

  if (!response.ok) {
    const err = new Error(payload?.message || `API error ${response.status}`);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

function normalizePath(p) {
  if (!p) return '';
  // ensure leading slash, remove duplicate slashes
  return ('/' + p).replace(/\/{2,}/g, '/');
}

function buildUrl(base, query) {
  if (!query) return base;
  const usp = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      v.forEach((vv) => usp.append(k, vv));
    } else {
      usp.append(k, v);
    }
  });
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// PUBLIC_INTERFACE
export const api = {
  /** Perform a GET request */
  get: (path, opts = {}) => request(path, { ...opts, method: 'GET' }),
  /** Perform a POST request */
  post: (path, body, opts = {}) => request(path, { ...opts, method: 'POST', body }),
  /** Perform a PUT request */
  put: (path, body, opts = {}) => request(path, { ...opts, method: 'PUT', body }),
  /** Perform a PATCH request */
  patch: (path, body, opts = {}) => request(path, { ...opts, method: 'PATCH', body }),
  /** Perform a DELETE request */
  delete: (path, opts = {}) => request(path, { ...opts, method: 'DELETE' }),
};
