import { api, getApiBaseUrl } from './client';

/**
 * Reports API wrapper. Aligns with expected endpoints:
 * - GET /api/reports              -> returns { summary: {...}, trends: [...] }
 * - GET /api/reports/export       -> CSV download (handled separately)
 * - GET /api/reports/summary      -> optional; falls back to /api/reports
 */

// PUBLIC_INTERFACE
export async function getReports() {
  /**
   * Fetch combined reports data.
   * Tries /api/reports first. If not available, attempts /api/reports/summary
   * and shapes a minimal response.
   */
  try {
    const data = await api.get('/api/reports');
    // Expecting { summary, trends }
    if (data && (data.summary || data.trends)) return data;
    // If backend returns array for trends directly, normalize
    if (Array.isArray(data)) {
      return { summary: null, trends: data };
    }
    return { summary: data || null, trends: [] };
  } catch (e) {
    // Try legacy summary endpoint as a fallback
    try {
      const summary = await api.get('/api/reports/summary');
      return { summary: summary || null, trends: [] };
    } catch (_e) {
      throw e;
    }
  }
}

// PUBLIC_INTERFACE
export async function getSummary() {
  /** Fetch only the summary report (aggregated KPIs). */
  return api.get('/api/reports/summary');
}

// PUBLIC_INTERFACE
export function exportReportsCsvUrl() {
  /**
   * Build the absolute URL to export CSV. This uses the discovered API base.
   * Authorization header is not part of a URL; server should accept Bearer tokens via header.
   * Since download via link doesn't attach headers, prefer using a blob fetch.
   */
  const base = getApiBaseUrl();
  return `${base}/api/reports/export`;
}

// PUBLIC_INTERFACE
export async function exportReportsCsvAsBlob() {
  /**
   * Fetch CSV as a blob so we can include Authorization header via the api client.
   * Returns a Blob instance; caller can trigger a download.
   */
  // We cannot reuse api.get due to its JSON handling. Perform a raw fetch mirroring client auth.
  const base = getApiBaseUrl();
  const url = `${base}/api/reports/export`;

  // Recreate a minimal token header using the api client internal getter via a trick:
  // The api client doesn't expose the token directly. We will call fetch without auth if not available.
  // For simplicity, issue a raw fetch. If the backend requires auth via header, the app may need CORS credentials.
  // Since our other endpoints use Authorization Bearer, provide best-effort: try from localStorage where AuthContext stores it.
  const token = localStorage.getItem('erp_auth_token');

  const res = await fetch(url, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text || `Failed to export CSV (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return await res.blob();
}
