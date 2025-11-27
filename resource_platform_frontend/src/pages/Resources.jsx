import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  listResources,
  createResource,
  updateResource,
  deleteResource,
  getWorkloadSummary,
  assignResourceToTask,
  unassignResourceFromTask,
} from '../api/resources';

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
export default function ResourcesPage() {
  /**
   * Resources management page:
   * - List resources with filters: type and availability
   * - CRUD with optimistic updates
   * - Assign/unassign resource to a task via in-memory endpoints
   * - Workload summary panel if provided by backend stub
   */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [filters, setFilters] = useState({
    type: 'all',
    available: 'all', // all | available | unavailable
    search: '',
  });

  const [summary, setSummary] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'person',
    capacity: '',
    meta_available: true,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [assignModal, setAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignForm, setAssignForm] = useState({ task_id: '', mode: 'assign' });
  const [assigning, setAssigning] = useState(false);

  // Abort controller for list
  const fetchAbortRef = useRef(null);

  const typeOptions = [
    { value: 'all', label: 'All types' },
    { value: 'person', label: 'Person' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'budget', label: 'Budget' },
  ];
  const availabilityOptions = [
    { value: 'all', label: 'All availability' },
    { value: 'available', label: 'Available' },
    { value: 'unavailable', label: 'Unavailable' },
  ];

  const filtered = useMemo(() => {
    let data = items;
    if (filters.type && filters.type !== 'all') {
      data = data.filter((r) => r.type === filters.type);
    }
    if (filters.available && filters.available !== 'all') {
      const flag = filters.available === 'available';
      data = data.filter((r) => {
        const avail = r?.meta?.available;
        // treat undefined as available
        return flag ? avail !== false : avail === false;
      });
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      data = data.filter((r) => (r.name || '').toLowerCase().includes(q));
    }
    return data;
  }, [items, filters]);

  async function fetchResources() {
    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    setErr('');
    try {
      const byType = filters.type !== 'all' ? filters.type : undefined;
      const byAvail =
        filters.available === 'all'
          ? undefined
          : filters.available === 'available'
          ? true
          : false;

      const data = await listResources({ type: byType, available: byAvail });
      setItems(data || []);
    } catch (e) {
      if (e?.name !== 'AbortError') {
        setErr(e?.message || 'Failed to load resources');
      }
    } finally {
      setLoading(false);
    }

    // try workload summary (non-fatal)
    try {
      const s = await getWorkloadSummary();
      if (s) setSummary(s);
    } catch (_e) {
      // ignore
    }
  }

  useEffect(() => {
    fetchResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.available, filters.search]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      type: 'person',
      capacity: '',
      meta_available: true,
    });
    setModalOpen(true);
  }

  function openEdit(resource) {
    setEditing(resource);
    setForm({
      name: resource.name || '',
      type: resource.type || 'person',
      capacity: resource.capacity ?? '',
      meta_available: resource?.meta?.available !== false,
    });
    setModalOpen(true);
  }

  function onFormChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        // optimistic update
        const prev = items;
        const optimistic = {
          ...editing,
          name: form.name,
          type: form.type,
          capacity: form.capacity === '' ? null : Number(form.capacity),
          meta: { ...(editing.meta || {}), available: !!form.meta_available },
          updated_at: new Date().toISOString(),
        };
        setItems((list) => list.map((r) => (r.id === editing.id ? optimistic : r)));

        try {
          const updated = await updateResource(editing.id, {
            name: form.name || null,
            type: form.type || null,
            capacity: form.capacity === '' ? null : Number(form.capacity),
            meta: { available: !!form.meta_available },
          });
          setItems((list) => list.map((r) => (r.id === updated.id ? updated : r)));
        } catch (err) {
          setItems(prev);
          throw err;
        }
      } else {
        // optimistic create
        const tempId = `tmp_${Date.now()}`;
        const optimistic = {
          id: tempId,
          name: form.name,
          type: form.type,
          capacity: form.capacity === '' ? null : Number(form.capacity),
          meta: { available: !!form.meta_available },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setItems((list) => [optimistic, ...list]);

        try {
          const created = await createResource({
            name: form.name,
            type: form.type,
            capacity: form.capacity === '' ? null : Number(form.capacity),
            meta: { available: !!form.meta_available },
          });
          setItems((list) => list.map((r) => (r.id === tempId ? created : r)));
        } catch (err) {
          setItems((list) => list.filter((r) => r.id !== tempId));
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

  async function onDelete(resourceId) {
    if (!window.confirm('Delete this resource? This cannot be undone.')) return;
    const prev = items;
    setDeletingId(resourceId);
    setItems((list) => list.filter((r) => r.id !== resourceId));
    try {
      await deleteResource(resourceId);
    } catch (e) {
      setItems(prev);
      alert(e?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  function openAssign(resource) {
    setAssignTarget(resource);
    setAssignForm({ task_id: '', mode: 'assign' });
    setAssignModal(true);
  }

  async function onAssignSubmit(e) {
    e.preventDefault();
    if (!assignTarget?.id || !assignForm.task_id) return;
    setAssigning(true);
    try {
      if (assignForm.mode === 'assign') {
        await assignResourceToTask(assignForm.task_id, assignTarget.id);
        // optimistic mark unavailable
        setItems((list) =>
          list.map((r) =>
            r.id === assignTarget.id ? { ...r, meta: { ...(r.meta || {}), available: false } } : r
          )
        );
      } else {
        await unassignResourceFromTask(assignForm.task_id, assignTarget.id);
        setItems((list) =>
          list.map((r) =>
            r.id === assignTarget.id ? { ...r, meta: { ...(r.meta || {}), available: true } } : r
          )
        );
      }
      setAssignModal(false);
    } catch (e2) {
      alert(e2?.message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <main className="main-content" id="main-content">
      <div className="page-header">
        <div>
          <h1 className="h1">Resources</h1>
          <div className="subtle">Manage resources and plan allocations</div>
        </div>
        <div>
          <button className="btn" onClick={openCreate}>+ New Resource</button>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 12 }}>
        <section className="surface" style={{ padding: 12 }}>
          <div className="subtle" style={{ marginBottom: 8 }}>Filters</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchResources();
            }}
            className="grid cols-3"
            style={{ gap: 10, gridTemplateColumns: '180px 180px 1fr' }}
          >
            <Select
              aria-label="Filter by type"
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <Select
              aria-label="Filter by availability"
              value={filters.available}
              onChange={(e) => setFilters((f) => ({ ...f, available: e.target.value }))}
            >
              {availabilityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <TextInput
              placeholder="Search by name"
              aria-label="Search by name"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </form>
        </section>
        <section className="surface" style={{ padding: 12 }}>
          <div className="subtle" style={{ marginBottom: 8 }}>Workload Summary</div>
          {summary ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {Object.entries(summary).map(([k, v]) => (
                <div key={k} className="surface" style={{ padding: 10, borderRadius: 10 }}>
                  <div className="subtle" style={{ fontSize: 12, marginBottom: 6 }}>{k.replaceAll('_', ' ')}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{String(v)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="subtle">No summary available.</div>
          )}
        </section>
        <section className="surface" style={{ padding: 12 }}>
          <div className="subtle" style={{ marginBottom: 8 }}>Tips</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Use availability filter to find free resources.</li>
            <li>Assign resources to tasks to block double booking.</li>
            <li>Meta fields are stored as key/value; available is inferred.</li>
          </ul>
        </section>
      </div>

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
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Capacity</th>
              <th style={thStyle}>Availability</th>
              <th style={thStyle}>Updated</th>
              <th style={{ ...thStyle, width: 240 }}>Actions</th>
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
                  No resources match the current filters. Try adjusting filters or create a new resource.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(17,24,39,0.06)' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div className="subtle" style={{ fontSize: 12 }}>{r.id}</div>
                  </td>
                  <td style={tdStyle}>{r.type}</td>
                  <td style={tdStyle}>{r.capacity ?? '-'}</td>
                  <td style={tdStyle}>
                    <AvailPill available={r?.meta?.available !== false} />
                  </td>
                  <td style={tdStyle}>{formatDate(r.updated_at)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn ghost" onClick={() => openEdit(r)}>Edit</button>
                      <button
                        className="btn ghost"
                        onClick={() => onDelete(r.id)}
                        disabled={deletingId === r.id}
                        title={deletingId === r.id ? 'Deleting…' : 'Delete'}
                      >
                        {deletingId === r.id ? 'Deleting…' : 'Delete'}
                      </button>
                      <button className="btn ghost" onClick={() => openAssign(r)}>
                        Assign
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? 'Edit Resource' : 'Create Resource'}
        onClose={() => setModalOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" form="resource-form" className="btn" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="resource-form" onSubmit={onSubmit} className="grid" style={{ gap: 10 }}>
          <label className="subtle" htmlFor="name">Name</label>
          <TextInput
            id="name"
            name="name"
            placeholder="Resource name"
            value={form.name}
            onChange={onFormChange}
            required
          />

          <label className="subtle" htmlFor="type">Type</label>
          <Select id="type" name="type" value={form.type} onChange={onFormChange} required>
            <option value="person">Person</option>
            <option value="equipment">Equipment</option>
            <option value="budget">Budget</option>
          </Select>

          <label className="subtle" htmlFor="capacity">Capacity (optional)</label>
          <TextInput
            id="capacity"
            name="capacity"
            type="number"
            min="0"
            placeholder="e.g., 40"
            value={form.capacity}
            onChange={onFormChange}
          />

          <label className="subtle" htmlFor="meta_available">
            <input
              id="meta_available"
              name="meta_available"
              type="checkbox"
              checked={!!form.meta_available}
              onChange={onFormChange}
              style={{ marginRight: 8, width: 16 }}
            />
            Available for allocation
          </label>
        </form>
      </Modal>

      {/* Assign/Unassign Modal */}
      <Modal
        open={assignModal}
        title={assignTarget ? `Assign: ${assignTarget.name}` : 'Assign Resource'}
        onClose={() => setAssignModal(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <button type="button" className="btn ghost" onClick={() => setAssignModal(false)}>
              Cancel
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                form="assign-form"
                className="btn"
                disabled={assigning || !assignForm.task_id}
                title="Assign or unassign"
              >
                {assigning ? 'Saving…' : assignForm.mode === 'assign' ? 'Assign' : 'Unassign'}
              </button>
            </div>
          </div>
        }
      >
        <form id="assign-form" onSubmit={onAssignSubmit} className="grid" style={{ gap: 10 }}>
          <label className="subtle" htmlFor="task_id">Task ID</label>
          <TextInput
            id="task_id"
            name="task_id"
            placeholder="task-123"
            value={assignForm.task_id}
            onChange={(e) => setAssignForm((f) => ({ ...f, task_id: e.target.value }))}
            required
          />

          <label className="subtle" htmlFor="mode">Mode</label>
          <Select
            id="mode"
            name="mode"
            value={assignForm.mode}
            onChange={(e) => setAssignForm((f) => ({ ...f, mode: e.target.value }))}
          >
            <option value="assign">Assign</option>
            <option value="unassign">Unassign</option>
          </Select>
        </form>
      </Modal>
    </main>
  );
}

const thStyle = { padding: 12, fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600 };
const tdStyle = { padding: 12, fontSize: 14, verticalAlign: 'top' };

function AvailPill({ available }) {
  const s = available
    ? { bg: 'rgba(16,185,129,0.12)', color: '#065F46', border: 'rgba(16,185,129,0.35)', label: 'Available' }
    : { bg: 'rgba(239,68,68,0.12)', color: '#991B1B', border: 'rgba(239,68,68,0.35)', label: 'Unavailable' };
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
      {s.label}
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
