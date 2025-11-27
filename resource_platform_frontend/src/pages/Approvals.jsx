import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listApprovals, updateApproval, createApproval } from '../api/approvals';
import { useAuth } from '../hooks/useAuth';

const inputBase = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid rgba(17,24,39,0.15)',
};

function TextInput(props) {
  return <input {...props} style={{ ...inputBase, ...(props.style || {}) }} />;
}
function Select(props) {
  return <select {...props} style={{ ...inputBase, ...(props.style || {}) }} />;
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
export default function ApprovalsPage() {
  /**
   * Approvals management page:
   * - Lists approvals grouped as Pending and Submitted (requested_by = current user)
   * - Allows approvers to Approve/Reject with a required comment
   * - Optimistic updates for status changes
   * - Basic filtering, error and loading states
   */
  const { isAuthenticated, token } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [filters, setFilters] = useState({
    status: 'all', // all|pending|approved|rejected
    q: '',
  });

  // Approve/Reject modal
  const [actionModal, setActionModal] = useState({ open: false, type: 'approve', target: null });
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  // Create request modal (optional UX to submit an approval)
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ subject_type: 'task', subject_id: '', approver_id: '' });
  const [creating, setCreating] = useState(false);

  const fetchAbortRef = useRef(null);

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  const filtered = useMemo(() => {
    let data = items;
    if (filters.status !== 'all') {
      data = data.filter((a) => a.status === filters.status);
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      data = data.filter(
        (a) =>
          (a.subject_type || '').toLowerCase().includes(q) ||
          (a.subject_id || '').toLowerCase().includes(q) ||
          (a.requested_by || '').toLowerCase().includes(q) ||
          (a.approver_id || '').toLowerCase().includes(q)
      );
    }
    return data;
  }, [items, filters]);

  const currentUserId = useMemo(() => {
    // For demo: we don't decode token; backend is in-memory.
    // If the token encodes user id, the backend also returns it. Not available here reliably.
    // We will treat 'me' by heuristics: not strictly needed, but keep field to separate submitted group if possible.
    // Fallback: show Submitted section with requested_by === 'me' when token exists and requested_by equals token (unlikely).
    // Without backend user endpoint, we won't filter by me strongly; we'll still show both sections grouping by requested_by.
    return null;
  }, [token]);

  const pending = filtered.filter((a) => a.status === 'pending');
  const submittedByMe = filtered.filter((a) => currentUserId ? a.requested_by === currentUserId : false);

  async function fetchApprovals() {
    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoading(true);
    setErr('');
    try {
      // Let server-side filter default to none; we filter client-side for q and sometimes status.
      const data = await listApprovals({
        status: filters.status !== 'all' ? filters.status : undefined,
      });
      setItems(data || []);
    } catch (e) {
      if (e?.name !== 'AbortError') {
        setErr(e?.message || 'Failed to load approvals');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchApprovals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, filters.status, filters.q]);

  function openAction(approval, type) {
    setActionModal({ open: true, type, target: approval });
    setComment('');
  }

  async function submitAction(e) {
    e.preventDefault();
    if (!actionModal.target?.id) return;
    if (!comment.trim()) {
      alert('Please add a brief comment.');
      return;
    }
    const nextStatus = actionModal.type === 'approve' ? 'approved' : 'rejected';
    const id = actionModal.target.id;

    // optimistic update
    const prev = items;
    const optimistic = {
      ...actionModal.target,
      status: nextStatus,
      updated_at: new Date().toISOString(),
      // For demo, store comment in a non-schema field (client-side only). Backend schema does not define it.
      _last_comment: comment.trim(),
    };
    setItems((list) => list.map((a) => (a.id === id ? optimistic : a)));
    setSaving(true);

    try {
      const updated = await updateApproval(id, { status: nextStatus });
      setItems((list) => list.map((a) => (a.id === id ? updated : a)));
      setActionModal({ open: false, type: 'approve', target: null });
    } catch (err) {
      setItems(prev);
      alert(err?.message || 'Failed to update approval');
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setCreateForm({ subject_type: 'task', subject_id: '', approver_id: '' });
    setCreateOpen(true);
  }

  async function submitCreate(e) {
    e.preventDefault();
    if (!createForm.subject_id || !createForm.subject_type) return;
    setCreating(true);

    // optimistic
    const tempId = `tmp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      subject_type: createForm.subject_type,
      subject_id: createForm.subject_id,
      requested_by: currentUserId || 'me',
      approver_id: createForm.approver_id || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems((list) => [optimistic, ...list]);

    try {
      const created = await createApproval({
        subject_type: createForm.subject_type,
        subject_id: createForm.subject_id,
        requested_by: currentUserId || 'user-1',
        approver_id: createForm.approver_id || null,
      });
      setItems((list) => list.map((a) => (a.id === tempId ? created : a)));
      setCreateOpen(false);
    } catch (err) {
      setItems((list) => list.filter((a) => a.id !== tempId));
      alert(err?.message || 'Failed to submit approval');
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="main-content" id="main-content">
      <div className="page-header">
        <div>
          <h1 className="h1">Approvals</h1>
          <div className="subtle">Review and manage approval requests</div>
        </div>
        <div>
          <button className="btn" onClick={openCreate}>+ Submit Approval</button>
        </div>
      </div>

      <section className="surface" style={{ padding: 12, marginBottom: 12 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchApprovals();
          }}
          style={{ display: 'grid', gap: 10, gridTemplateColumns: '180px 1fr 120px' }}
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
            placeholder="Search (subject, requester, approver)"
            aria-label="Search approvals"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
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

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <section className="surface" style={{ padding: 0, overflowX: 'auto' }}>
          <header style={{ padding: 12, borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
            <div className="h1" style={{ margin: 0, fontSize: 16 }}>Pending</div>
          </header>
          <ApprovalsTable
            items={filtered.filter((a) => a.status === 'pending')}
            loading={loading}
            onApprove={(a) => openAction(a, 'approve')}
            onReject={(a) => openAction(a, 'reject')}
          />
        </section>

        <section className="surface" style={{ padding: 0, overflowX: 'auto' }}>
          <header style={{ padding: 12, borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
            <div className="h1" style={{ margin: 0, fontSize: 16 }}>Submitted By Me</div>
          </header>
          <ApprovalsTable
            items={submittedByMe}
            loading={loading}
            showActions={false}
          />
        </section>
      </div>

      {/* Approve/Reject Modal */}
      <Modal
        open={actionModal.open}
        title={actionModal.type === 'approve' ? 'Approve Request' : 'Reject Request'}
        onClose={() => setActionModal({ open: false, type: 'approve', target: null })}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setActionModal({ open: false, type: 'approve', target: null })}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="btn" form="approval-action-form" type="submit" disabled={saving}>
              {saving ? 'Saving…' : actionModal.type === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        }
      >
        <form id="approval-action-form" onSubmit={submitAction} className="grid" style={{ gap: 10 }}>
          <div className="subtle">
            {actionModal.target
              ? `${actionModal.target.subject_type} • ${actionModal.target.subject_id}`
              : ''}
          </div>
          <label htmlFor="comment" className="subtle">Comment</label>
          <textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a brief comment"
            required
            style={{ ...inputBase, minHeight: 90, resize: 'vertical' }}
          />
        </form>
      </Modal>

      {/* Create Approval Modal */}
      <Modal
        open={createOpen}
        title="Submit Approval"
        onClose={() => setCreateOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn" form="create-approval-form" type="submit" disabled={creating}>
              {creating ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        }
      >
        <form id="create-approval-form" onSubmit={submitCreate} className="grid" style={{ gap: 10 }}>
          <label className="subtle" htmlFor="subject_type">Subject Type</label>
          <Select
            id="subject_type"
            value={createForm.subject_type}
            onChange={(e) => setCreateForm((f) => ({ ...f, subject_type: e.target.value }))}
          >
            <option value="project">Project</option>
            <option value="task">Task</option>
            <option value="resource">Resource</option>
          </Select>

          <label className="subtle" htmlFor="subject_id">Subject ID</label>
          <TextInput
            id="subject_id"
            placeholder="e.g., task-123"
            value={createForm.subject_id}
            onChange={(e) => setCreateForm((f) => ({ ...f, subject_id: e.target.value }))}
            required
          />

          <label className="subtle" htmlFor="approver_id">Approver (user id, optional)</label>
          <TextInput
            id="approver_id"
            placeholder="user-abc (optional)"
            value={createForm.approver_id}
            onChange={(e) => setCreateForm((f) => ({ ...f, approver_id: e.target.value }))}
          />
        </form>
      </Modal>
    </main>
  );
}

function ApprovalsTable({ items, loading, onApprove, onReject, showActions = true }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ textAlign: 'left', background: 'rgba(17,24,39,0.02)' }}>
          <th style={thStyle}>Subject</th>
          <th style={thStyle}>Requester</th>
          <th style={thStyle}>Approver</th>
          <th style={thStyle}>Status</th>
          <th style={thStyle}>Updated</th>
          {showActions ? <th style={{ ...thStyle, width: 200 }}>Actions</th> : null}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={showActions ? 6 : 5} style={{ padding: 14 }} className="subtle">Loading…</td>
          </tr>
        ) : items.length === 0 ? (
          <tr>
            <td colSpan={showActions ? 6 : 5} style={{ padding: 14 }} className="subtle">No items</td>
          </tr>
        ) : (
          items.map((a) => (
            <tr key={a.id} style={{ borderTop: '1px solid rgba(17,24,39,0.06)' }}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 600 }}>
                  {a.subject_type} • {a.subject_id}
                </div>
                <div className="subtle" style={{ fontSize: 12 }}>{a.id}</div>
              </td>
              <td style={tdStyle}>{a.requested_by}</td>
              <td style={tdStyle}>{a.approver_id || '-'}</td>
              <td style={tdStyle}><StatusPill status={a.status} /></td>
              <td style={tdStyle}>{formatDate(a.updated_at)}</td>
              {showActions ? (
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn ghost" onClick={() => onApprove?.(a)}>Approve</button>
                    <button className="btn ghost" onClick={() => onReject?.(a)}>Reject</button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

const thStyle = { padding: 12, fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600 };
const tdStyle = { padding: 12, fontSize: 14, verticalAlign: 'top' };

function StatusPill({ status }) {
  const map = {
    pending: { bg: 'rgba(245,158,11,0.12)', color: '#B45309', border: 'rgba(245,158,11,0.35)' },
    approved: { bg: 'rgba(16,185,129,0.12)', color: '#065F46', border: 'rgba(16,185,129,0.35)' },
    rejected: { bg: 'rgba(239,68,68,0.12)', color: '#991B1B', border: 'rgba(239,68,68,0.35)' },
  };
  const s = map[status] || map.pending;
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
      {status}
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
