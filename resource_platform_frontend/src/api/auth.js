export async function signup({ name, email, password }) {
  /** PUBLIC_INTERFACE
   * Sign up via backend endpoint and return the response JSON.
   */
  const apiBase =
    process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_BASE ||
    "";
  const res = await fetch(`${apiBase}/api/auth/signup`, {
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
