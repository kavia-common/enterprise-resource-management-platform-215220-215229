import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listTasks, createTask, updateTask, deleteTask } from '../api/tasks';
import { useAuth } from '../hooks/useAuth';

const inputBase = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid rgba(17,24,39,0.15)',
};

function Select({ value, onChange, children, style, ...rest }) {
  return (
    <select
      value={value ?? ''}
      onChange={onChange}
      style={{ ...inputBase, ...style }}
      {...rest}
    >
      {children}
    </select>
  );
}

function TextInput({ value, onChange, style, ...rest }) {
  return (
    <input
      value={value ?? ''}
      onChange={onChange}
      style={{ ...inputBase, ...style }}
      {...rest}
    />
  );
}

function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.35)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="surface"
        style={{
          width: '100%',
          maxWidth: 560,
          padding: 16,
          borderRadius: '14px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="modal-title" className="h1" style={{ margin: 0 }}>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
        {footer ? <div style={{ marginTop: 16 }}>{footer}</div> : null}
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
export default function TasksPage() {
  /**
   * Tasks management page: list/filter/create/edit/delete.
   * - API paths are aligned with backend: /api/tasks
   * - Filters: status (server) + assignee text (client)
   * - Error, empty, loading states
   * - Minimal optimistic updates for better UX
   */
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [filters, setFilters] = useState({
    status: 'all',
    assignee_text: '',
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    project_id: '',
    title: '',
    description: '',
    assignee_id: '',
    status: 'open',
  });
  const [saving, setSaving] = useState(false);

  // track delete in progress to disable buttons per row
  const [deletingId, setDeletingId] = useState(null);

  // AbortController for fetchTasks to avoid race conditions on rapid filter changes
  const fetchAbortRef = useRef(null);

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done', label: 'Done' },
  ];

  const filtered = useMemo(() => {
    let data = items;
    if (filters.status && filters.status !== 'all') {
      data = data.filter((t) => t.status === filters.status);
    }
    if (filters.assignee_text) {
      const q = filters.assignee_text.toLowerCase();
      data = data.filter((t) => (t.assignee_id || '').toLowerCase().includes(q));
    }
    return data;
  }, [items, filters]);

  const fetchTasks = async () => {
    // cancel prior pending request
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    setErr('');
    try {
      const data = await listTasks({
        status: filters.status !== 'all' ? filters.status : undefined,
        assignee_id: undefined,
        assignee_text: filters.assignee_text || undefined,
      });
      setItems(data || []);
    } catch (e) {
      // ignore abort errors
      if (e?.name !== 'AbortError') {
        setErr(e?.message || 'Failed to load tasks');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, filters.status, filters.assignee_text]);

  function openCreate() {
    setEditing(null);
    setForm({
      project_id: '',
      title: '',
      description: '',
      assignee_id: '',
      status: 'open',
    });
    setModalOpen(true);
  }

  function openEdit(task) {
    setEditing(task);
    setForm({
      project_id: task.project_id || '',
      title: task.title || '',
      description: task.description || '',
      assignee_id: task.assignee_id || '',
      status: task.status || 'open',
    });
    setModalOpen(true);
  }

  async function onDelete(taskId) {
    if (!window.confirm('Are you sure you want to delete this task? This cannot be undone.')) return;

    // optimistic UI: remove immediately, rollback on failure
    const prev = items;
    setDeletingId(taskId);
    setItems((list) => list.filter((t) => t.id !== taskId));
    try {
      await deleteTask(taskId);
    } catch (e) {
      // rollback
      setItems(prev);
      alert(e?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  function onFormChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      if (editing) {
        // optimistic update for edit
        const prev = items;
        const optimistic = {
          ...editing,
          title: form.title,
          description: form.description || null,
          assignee_id: form.assignee_id || null,
          status: form.status || 'open',
          updated_at: new Date().toISOString(),
        };
        setItems((list) => list.map((t) => (t.id === editing.id ? optimistic : t)));

        try {
          const updated = await updateTask(editing.id, {
            title: form.title || null,
            description: form.description || null,
            assignee_id: form.assignee_id || null,
            status: form.status || null,
          });
          setItems((list) => list.map((t) => (t.id === updated.id ? updated : t)));
        } catch (err) {
          // rollback
          setItems(prev);
          throw err;
        }
      } else {
        // optimistic create: temporary id
        const tempId = `tmp_${Date.now()}`;
        const optimistic = {
          id: tempId,
          project_id: form.project_id,
          title: form.title,
          description: form.description || null,
          assignee_id: form.assignee_id || null,
          status: form.status || 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setItems((list) => [optimistic, ...list]);

        try {
          const created = await createTask({
            project_id: form.project_id,
            title: form.title,
            description: form.description || null,
            assignee_id: form.assignee_id || null,
            status: form.status || 'open',
          });
          // replace temp with server one
          setItems((list) =>
            list.map((t) => (t.id === tempId ? created : t))
          );
        } catch (err) {
          // remove optimistic item
          setItems((list) => list.filter((t) => t.id !== tempId));
          throw err;
        }
      }
      setModalOpen(false);
    } catch (e2) {
      alert(e2?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="main-content" id="main-content">
      <div className="page-header">
        <div>
          <h1 className="h1">Tasks</h1>
          <div className="subtle">Create, update and track tasks</div>
        </div>
        <div>
          <button className="btn" onClick={openCreate}>+ New Task</button>
        </div>
      </div>

      <section className="surface" style={{ padding: 12, marginBottom: 12 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchTasks();
          }}
          style={{ display: 'grid', gap: 10, gridTemplateColumns: '200px 1fr 120px' }}
        >
          <Select
            aria-label="Filter by status"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          <TextInput
            placeholder="Filter by assignee (text match)"
            aria-label="Filter by assignee"
            value={filters.assignee_text}
            onChange={(e) => setFilters((f) => ({ ...f, assignee_text: e.target.value }))}
          />
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Loading…' : 'Apply'}
          </button>
        </form>
      </section>

      {err ? (
        <div
          role="alert"
          className="surface"
          style={{
            padding: 12,
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.06)',
            color: 'var(--color-error)',
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      ) : null}

      <section className="surface" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: 'rgba(17,24,39,0.02)' }}>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Project</th>
              <th style={thStyle}>Assignee</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Updated</th>
              <th style={{ ...thStyle, width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ padding: 14 }} className="subtle">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: 14 }} className="subtle">
                  No tasks match the current filters. Try adjusting filters or create a new task.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid rgba(17,24,39,0.06)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div className="subtle" style={{ fontSize: 12 }}>{t.description}</div>
                  </td>
                  <td style={tdStyle}>{t.project_id}</td>
                  <td style={tdStyle}>{t.assignee_id || '-'}</td>
                  <td style={tdStyle}>
                    <StatusPill status={t.status} />
                  </td>
                  <td style={tdStyle}>{formatDate(t.updated_at)}</td>
                  <td style={{ ...tdStyle }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn ghost" onClick={() => openEdit(t)}>Edit</button>
                      <button
                        className="btn ghost"
                        onClick={() => onDelete(t.id)}
                        aria-label={`Delete ${t.title}`}
                        disabled={deletingId === t.id}
                        title={deletingId === t.id ? 'Deleting…' : 'Delete'}
                      >
                        {deletingId === t.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Task' : 'Create Task'}
        onClose={() => setModalOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="task-form" className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="task-form" onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
          {!editing ? (
            <>
              <label className="subtle" htmlFor="project_id">Project ID</label>
              <TextInput
                id="project_id"
                name="project_id"
                placeholder="Enter project id"
                value={form.project_id}
                onChange={onFormChange}
                required
              />
            </>
          ) : null}

          <label className="subtle" htmlFor="title">Title</label>
          <TextInput
            id="title"
            name="title"
            placeholder="Task title"
            value={form.title}
            onChange={onFormChange}
            required
          />

          <label className="subtle" htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={form.description ?? ''}
            onChange={onFormChange}
            style={{ ...inputBase, minHeight: 90, resize: 'vertical' }}
            placeholder="Optional description"
          />

          <label className="subtle" htmlFor="assignee_id">Assignee (user id)</label>
          <TextInput
            id="assignee_id"
            name="assignee_id"
            placeholder="user-123 (optional)"
            value={form.assignee_id ?? ''}
            onChange={onFormChange}
          />

          <label className="subtle" htmlFor="status">Status</label>
          <Select id="status" name="status" value={form.status} onChange={onFormChange} required>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </Select>
        </form>
      </Modal>
    </main>
  );
}

const thStyle = { padding: 12, fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600 };
const tdStyle = { padding: 12, fontSize: 14, verticalAlign: 'top' };

function StatusPill({ status }) {
  const stylesMap = {
    open: { bg: 'rgba(37,99,235,0.1)', color: '#2563EB', border: 'rgba(37,99,235,0.25)' },
    in_progress: { bg: 'rgba(245,158,11,0.12)', color: '#B45309', border: 'rgba(245,158,11,0.35)' },
    done: { bg: 'rgba(16,185,129,0.12)', color: '#065F46', border: 'rgba(16,185,129,0.35)' },
  };
  const s = stylesMap[status] || stylesMap.open;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: 999,
        fontSize: 12,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {status?.replace('_', ' ') || 'open'}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
