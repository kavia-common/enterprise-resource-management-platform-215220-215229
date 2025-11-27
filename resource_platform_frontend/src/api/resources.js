import { api } from './client';

// PUBLIC_INTERFACE
export async function listResources({ type, available } = {}) {
  /**
   * GET /api/resources
   * Server supports type filter. Availability is optionally filtered client-side if not provided by backend.
   * Query: { type }
   * If available param is provided, we apply a client-side filter on resource.meta.available when present.
   */
  const data = await api.get('/api/resources', { query: { type } });
  if (available === undefined || available === null) return data || [];
  const want = String(available) === 'true' || available === true;
  return (data || []).filter((r) => {
    const flag = r?.meta?.available;
    return want ? flag !== false : flag === false; // show all if undefined unless available=true
  });
}

// PUBLIC_INTERFACE
export async function createResource(payload) {
  /**
   * POST /api/resources
   * Payload: { name, type, capacity?, meta? }
   */
  return api.post('/api/resources', payload);
}

// PUBLIC_INTERFACE
export async function updateResource(resourceId, payload) {
  /**
   * PUT /api/resources/{id}
   * Payload: partial update model supported by backend
   */
  return api.put(`/api/resources/${resourceId}`, payload);
}

// PUBLIC_INTERFACE
export async function deleteResource(resourceId) {
  /**
   * DELETE /api/resources/{id}
   */
  return api.delete(`/api/resources/${resourceId}`);
}

// PUBLIC_INTERFACE
export async function getWorkloadSummary() {
  /**
   * Optional: GET /api/resources/summary (if backend exposes; otherwise ignore errors)
   * Fallback: derive minimal summary client-side where needed.
   */
  try {
    return await api.get('/api/resources/summary');
  } catch (_e) {
    return null;
  }
}

// PUBLIC_INTERFACE
export async function assignResourceToTask(taskId, resourceId) {
  /**
   * POST /api/tasks/{taskId}/assign
   * Expected payload: { resource_id }
   * Returns updated task or assignment confirmation.
   * Note: Backend endpoint is an in-memory stub per task description.
   */
  return api.post(`/api/tasks/${taskId}/assign`, { resource_id: resourceId });
}

// PUBLIC_INTERFACE
export async function unassignResourceFromTask(taskId, resourceId) {
  /**
   * POST /api/tasks/{taskId}/unassign
   * Expected payload: { resource_id }
   */
  return api.post(`/api/tasks/${taskId}/unassign`, { resource_id: resourceId });
}
