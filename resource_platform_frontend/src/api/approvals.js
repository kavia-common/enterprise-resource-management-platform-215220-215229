import { api } from './client';

/**
 * Approval shapes are aligned with backend OpenAPI:
 * - Approval: { id, subject_type, subject_id, requested_by, approver_id?, status, created_at, updated_at }
 * - Create:   { subject_type, subject_id, requested_by, approver_id? }
 * - Update:   { status?, approver_id? }
 */

// PUBLIC_INTERFACE
export async function listApprovals({ status } = {}) {
  /** Fetch approvals with optional status filter: pending|approved|rejected */
  return api.get('/api/approvals', { query: { status } });
}

// PUBLIC_INTERFACE
export async function createApproval(payload) {
  /** Create an approval request */
  return api.post('/api/approvals', payload);
}

// PUBLIC_INTERFACE
export async function updateApproval(approvalId, payload) {
  /** Update an approval by id: supports status and approver_id updates */
  return api.put(`/api/approvals/${approvalId}`, payload);
}

// PUBLIC_INTERFACE
export async function getApproval(approvalId) {
  /** Retrieve an approval by id */
  return api.get(`/api/approvals/${approvalId}`);
}

// PUBLIC_INTERFACE
export async function deleteApproval(approvalId) {
  /** Delete an approval by id */
  return api.delete(`/api/approvals/${approvalId}`);
}
