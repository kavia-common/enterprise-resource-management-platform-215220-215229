import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";

// PUBLIC_INTERFACE
export default function Signup() {
  /** Signup page with client-side validation and API call to backend signup endpoint.
   * - Fields: name, email, password, confirm password
   * - Validates non-empty, email format, password confirmation
   * - On success: stores token and role via AuthContext (if available) and redirects to Dashboard
   */
  const navigate = useNavigate();

  // If an AuthContext exists in the app, we attempt to use it. Fallback to localStorage.
  let authCtx = null;
  try {
    // Lazy require to avoid breaking if context file path differs; adjust if necessary in integration.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { AuthContext } = require("../context/AuthContext");
    authCtx = useContext(AuthContext);
  } catch {
    // no-op: context may not exist in this template; we fallback to localStorage handling below
  }

  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  const apiBase =
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_BASE ||
    "";

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    if (form.password !== form.confirm) e.confirm = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onChange = (ev) => {
    const { name, value } = ev.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setApiError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Failed to sign up");
      }
      const data = await res.json();
      // Expecting { token, user: { role, ... } }
      const { token, user } = data || {};
      if (authCtx && authCtx.login) {
        // If app provides login method in context
        authCtx.login({ token, user });
      } else {
        // Fallback: store in localStorage for demo
        if (token) localStorage.setItem("token", token);
        if (user?.role) localStorage.setItem("role", user.role);
        if (user) localStorage.setItem("user", JSON.stringify(user));
      }
      navigate("/dashboard");
    } catch (err) {
      setApiError(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f9fafb" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}>
        <h1 style={{ margin: 0, fontSize: 24, color: "#111827" }}>Create your account</h1>
        <p style={{ marginTop: 8, color: "#6b7280" }}>
          Already have an account? <Link to="/login" style={{ color: "#2563EB", textDecoration: "none" }}>Log in</Link>
        </p>

        {apiError ? (
          <div style={{ background: "#FEF2F2", color: "#B91C1C", padding: "10px 12px", borderRadius: 8, marginTop: 12 }}>
            {apiError}
          </div>
        ) : null}

        <form onSubmit={submit} noValidate style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="name" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={onChange}
              placeholder="Jane Doe"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            {errors.name ? <div style={{ color: "#EF4444", marginTop: 6 }}>{errors.name}</div> : null}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="email" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder="jane@example.com"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            {errors.email ? <div style={{ color: "#EF4444", marginTop: 6 }}>{errors.email}</div> : null}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="password" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              placeholder="********"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            {errors.password ? <div style={{ color: "#EF4444", marginTop: 6 }}>{errors.password}</div> : null}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="confirm" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Confirm Password</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              value={form.confirm}
              onChange={onChange}
              placeholder="********"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            {errors.confirm ? <div style={{ color: "#EF4444", marginTop: 6 }}>{errors.confirm}</div> : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              background: submitting ? "#93C5FD" : "#2563EB",
              color: "#fff",
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "background 0.2s ease",
            }}
          >
            {submitting ? "Creating account..." : "Sign up"}
          </button>

          <div style={{ marginTop: 14, textAlign: "center", color: "#6b7280" }}>
            <span>or</span>{" "}
            <Link to="/login" style={{ color: "#2563EB", textDecoration: "none" }}>Log in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
