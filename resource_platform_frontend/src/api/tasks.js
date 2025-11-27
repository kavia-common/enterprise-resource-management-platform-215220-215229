import { api } from './client';

// PUBLIC_INTERFACE
export async function listTasks({ project_id, assignee_id, status, assignee_text } = {}) {
  /**
   * Fetch tasks with optional filters.
   * Backend supports project_id, assignee_id, status. We add assignee_text client-side filter.
   */
  const data = await api.get('/api/tasks', { query: { project_id, assignee_id, status } });
  if (assignee_text) {
    const q = String(assignee_text).toLowerCase();
    return (data || []).filter((t) => (t.assignee_id || '').toLowerCase().includes(q));
  }
  return data;
}

// PUBLIC_INTERFACE
export async function createTask(payload) {
  /**
   * Create a task.
   * Required fields: project_id, title
   * Optional: description, assignee_id, status (open|in_progress|done)
   */
  return api.post('/api/tasks', payload);
}

// PUBLIC_INTERFACE
export async function updateTask(taskId, payload) {
  /**
   * Update a task by id.
   */
  return api.put(`/api/tasks/${taskId}`, payload);
}

// PUBLIC_INTERFACE
export async function deleteTask(taskId) {
  /**
   * Delete a task by id.
   */
  return api.delete(`/api/tasks/${taskId}`);
}
